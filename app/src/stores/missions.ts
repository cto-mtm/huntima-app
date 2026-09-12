import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
// One definition of the wire format, shared with the Cloud Function that
// serves it. See docs/architecture.md § Shared contracts.
import { missionListSchema, SEED_CAMPAIGN, type Mission } from 'shared'
import { apiFetch } from '../lib/api'

export type { Mission }

export const useMissionsStore = defineStore('missions', () => {
  // Seeded from the shared demo campaign so the very first paint has
  // content. A stadium concourse is one of the worst RF environments a
  // phone will ever see — 30,000 people on one tower — so "the request
  // failed" has to be a designed state, not an error screen.
  const missions = ref<Mission[]>([...SEED_CAMPAIGN.missions])
  // Which hunt these missions belong to. Capture verification posts it back,
  // so the server looks the target up in the same campaign the fan is playing.
  const campaignId = ref(SEED_CAMPAIGN.campaignId)
  const badgeTarget = ref(SEED_CAMPAIGN.badgeTarget)
  const loading = ref(false)
  /** True when the list on screen is the seed campaign, not the server's. */
  const usingFallback = ref(true)

  const byId = computed(() => (id: string) => missions.value.find((m) => m.id === id) ?? null)

  /**
   * SEAM: `GET /missions` currently serves SEED_CAMPAIGN straight back.
   * When it becomes a Firestore read, nothing here changes — the contract
   * is `missionListSchema`, and it lives in one place for both sides.
   */
  async function load(): Promise<void> {
    loading.value = true

    const result = await apiFetch<unknown>('/missions')

    if (result.ok) {
      const parsed = missionListSchema.safeParse(result.data)
      if (parsed.success) {
        missions.value = parsed.data.missions
        campaignId.value = parsed.data.campaignId
        badgeTarget.value = parsed.data.badgeTarget
        usingFallback.value = false
        loading.value = false
        return
      }
      // Server reachable but shape wrong. Now that both ends share one
      // schema this should only happen on a version skew between a
      // deployed function and a cached client — keep the seed on screen
      // and make it findable.
      console.error('[missions] unexpected /missions payload', parsed.error.issues)
    }

    usingFallback.value = true
    loading.value = false
  }

  /**
   * Demo of the TransitionGroup FLIP recipe (docs/animations.md, Recipe 4).
   * Reordering is safe because every card keys off `mission.id`.
   */
  function shuffle(): void {
    const next = [...missions.value]
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[next[i], next[j]] = [next[j], next[i]]
    }
    missions.value = next
  }

  return { missions, campaignId, badgeTarget, loading, usingFallback, byId, load, shuffle }
})
