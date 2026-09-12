import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  campaignSchema,
  campaignStatsSchema,
  missionListPayloadSchema,
  type Campaign,
  type CampaignInput,
  type CampaignStats,
  type Mission,
} from 'shared'
import { apiFetch } from '../lib/api'
import { useSessionStore } from './session'

/**
 * Admin-side hunt CRUD.
 *
 * Every call here carries the staff member's Firebase ID token and is
 * enforced server-side against the `admin` custom claim. Nothing in this
 * store is a security boundary — it is the UI's view of data the server
 * already decided this person may touch.
 */
export const useHuntsStore = defineStore('hunts', () => {
  const session = useSessionStore()

  const campaigns = ref<Campaign[]>([])
  const current = ref<Campaign | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  async function authed<T>(path: string, init?: RequestInit) {
    const token = await session.getIdToken()
    if (!token) return { ok: false as const, error: 'Not signed in' }

    return apiFetch<T>(path, {
      ...init,
      headers: { ...init?.headers, Authorization: `Bearer ${token}` },
    })
  }

  async function loadAll(): Promise<void> {
    loading.value = true
    error.value = null

    const result = await authed<{ campaigns: unknown[] }>('/admin/campaigns')
    if (result.ok) {
      campaigns.value = result.data.campaigns
        .map((c) => campaignSchema.safeParse(c))
        .filter((r): r is { success: true; data: Campaign } => r.success)
        .map((r) => r.data)
    } else {
      error.value = result.error
    }

    loading.value = false
  }

  async function loadOne(id: string): Promise<void> {
    loading.value = true
    error.value = null

    const result = await authed<unknown>(`/admin/campaigns/${id}`)
    if (result.ok) {
      const parsed = campaignSchema.safeParse(result.data)
      current.value = parsed.success ? parsed.data : null
      if (!parsed.success) error.value = 'Unexpected campaign shape from the server.'
    } else {
      current.value = null
      error.value = result.error
    }

    loading.value = false
  }

  async function create(input: CampaignInput): Promise<Campaign | null> {
    saving.value = true
    error.value = null

    const result = await authed<unknown>('/admin/campaigns', {
      method: 'POST',
      body: JSON.stringify(input),
    })

    saving.value = false

    if (!result.ok) {
      error.value = result.error
      return null
    }

    const parsed = campaignSchema.safeParse(result.data)
    if (!parsed.success) return null

    campaigns.value = [...campaigns.value, parsed.data]
    return parsed.data
  }

  async function patch(id: string, body: Partial<CampaignInput>): Promise<boolean> {
    saving.value = true
    error.value = null

    const result = await authed<unknown>(`/admin/campaigns/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })

    saving.value = false

    if (!result.ok) {
      error.value = result.error
      return false
    }

    const parsed = campaignSchema.safeParse(result.data)
    if (parsed.success) current.value = parsed.data
    return true
  }

  /**
   * Replaces the whole mission list in one write.
   *
   * Per-mission endpoints would let a fan load a hunt mid-edit and see three
   * of five steps. The editor works on a local draft and commits it as a
   * unit, which is also how reordering stays coherent.
   */
  async function saveMissions(id: string, missions: Mission[]): Promise<boolean> {
    saving.value = true
    error.value = null

    // Validate against the SAME schema the function parses it with, so a
    // malformed draft surfaces here as a named field rather than as a 400
    // carrying server-side zod output.
    const payload = missionListPayloadSchema.safeParse({
      missions: missions.map((m, index) => ({ ...m, order: index })),
    })

    if (!payload.success) {
      saving.value = false
      error.value = payload.error.issues[0]?.message ?? 'Invalid mission'
      return false
    }

    const result = await authed<unknown>(`/admin/campaigns/${id}/missions`, {
      method: 'PUT',
      body: JSON.stringify(payload.data),
    })

    saving.value = false

    if (!result.ok) {
      error.value = result.error
      return false
    }

    const parsed = campaignSchema.safeParse(result.data)
    if (parsed.success) current.value = parsed.data
    return true
  }

  /**
   * Aggregate analytics for one hunt. The server returns zeroes (not a 404)
   * for a hunt nobody has played, so a successful fetch always carries a
   * renderable shape.
   */
  async function loadStats(id: string): Promise<CampaignStats | null> {
    const result = await authed<unknown>(`/admin/campaigns/${id}/stats`)
    if (!result.ok) {
      error.value = result.error
      return null
    }
    const parsed = campaignStatsSchema.safeParse(result.data)
    return parsed.success ? parsed.data : null
  }

  async function remove(id: string): Promise<boolean> {
    const result = await authed<unknown>(`/admin/campaigns/${id}`, { method: 'DELETE' })
    if (!result.ok) {
      error.value = result.error
      return false
    }
    campaigns.value = campaigns.value.filter((c) => c.id !== id)
    return true
  }

  return { campaigns, current, loading, saving, error, loadAll, loadOne, create, patch, saveMissions, loadStats, remove }
})
