import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
// One definition of the wire format, shared with the Cloud Function that
// serves it. See docs/architecture.md § Shared contracts.
import { missionListSchema, type Mission, type Prize } from 'shared'
import { apiFetch } from '../lib/api'

// Note: `Mission` is NOT re-exported here. Components import it from
// 'shared' directly — routing a shared type through a store invites a second,
// subtly different definition later.

export const useMissionsStore = defineStore('missions', () => {
  /** Which org's hunt this is. Set by the router guard via `activate`. */
  const slug = ref<string | null>(null)
  // No seed. The hub reflects the real backend: it starts empty, fills from
  // GET /t/:slug/missions, and shows an empty state when no hunt is
  // published. A failed request is a distinct `loadError` state, not a
  // silent fallback.
  const missions = ref<Mission[]>([])
  // Which hunt these missions belong to. Capture verification posts it back,
  // so the server looks the target up in the same campaign the fan is playing.
  const campaignId = ref('')
  /** The hunt's display name, used when a completed hunt becomes a trophy. */
  const name = ref('')
  const badgeTarget = ref(0)
  /** The prize for this hunt, shown on the redeem screen. Null when unset. */
  const prize = ref<Prize | null>(null)
  const loading = ref(false)
  /** True when GET /missions failed (network/server), as opposed to no hunt. */
  const loadError = ref(false)
  /** True once a successful load has completed, so the UI can tell empty
   *  ("no published hunt") apart from "not loaded yet". */
  const loaded = ref(false)

  const byId = computed(() => (id: string) => missions.value.find((m) => m.id === id) ?? null)

  /**
   * Scopes the store to an org and (re)loads its published hunt. Idempotent
   * per slug — the router guard calls this on every slugged navigation, so a
   * fan moving between pages never refetches, and a fan landing on a second
   * club's page never sees the first club's missions.
   */
  function activate(nextSlug: string): void {
    if (slug.value === nextSlug) return
    slug.value = nextSlug
    missions.value = []
    campaignId.value = ''
    name.value = ''
    badgeTarget.value = 0
    prize.value = null
    loaded.value = false
    loadError.value = false
    void load()
  }

  /**
   * `GET /t/:slug/missions` reads the org's published hunt from Firestore and
   * returns an empty list when none is published. The contract is
   * `missionListSchema`, shared by both ends, so this parse is the only place
   * the shape is trusted.
   */
  async function load(): Promise<void> {
    const requested = slug.value
    if (!requested) return

    loading.value = true
    loadError.value = false

    const result = await apiFetch<unknown>(`/t/${requested}/missions`)

    // A rapid org switch can land a stale response — discard it. Clear the
    // flag first: the newer load manages its own, but only if one is coming.
    if (slug.value !== requested) {
      loading.value = false
      return
    }

    if (result.ok) {
      const parsed = missionListSchema.safeParse(result.data)
      if (parsed.success) {
        missions.value = parsed.data.missions
        campaignId.value = parsed.data.campaignId
        name.value = parsed.data.name
        badgeTarget.value = parsed.data.badgeTarget
        prize.value = parsed.data.prize ?? null
        loaded.value = true
        loading.value = false
        return
      }
      // Server reachable but shape wrong — a version skew between a deployed
      // function and a cached client. Surface it as a load error rather than
      // pretending there is no hunt.
      console.error('[missions] unexpected /missions payload', parsed.error.issues)
    }

    // Network or server failure: do NOT invent missions. Show the error state.
    loadError.value = true
    loading.value = false
  }

  return { slug, missions, campaignId, name, badgeTarget, prize, loading, loadError, loaded, byId, activate, load }
})
