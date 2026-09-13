import { defineStore } from 'pinia'
import { computed, onScopeDispose, ref, watch } from 'vue'
import { useSessionStore } from './session'
import { useMissionsStore } from './missions'
import { reportFanEvent } from '../lib/analytics'
import { apiFetch } from '../lib/api'

const STORAGE_KEY = 'huntima:progress'
/** Authenticated cross-device progress store. See helpers/fanProgress.ts. */
const PROGRESS_ENDPOINT = '/me/progress'

/**
 * A hunt the fan has finished. This is what a "trophy" is: a past win, kept
 * across hunts. Distinct from `earned`, which is the in-progress badge set of
 * whatever hunt is loaded right now.
 */
interface WonHunt {
  campaignId: string
  name: string
  /** Epoch ms when the hunt was completed. */
  wonAt: number
  /** Which org's hunt this was — provenance for the trophy shelf. Absent on
   *  trophies recorded before the platform pivot. */
  tenantSlug?: string
}

interface PersistedProgress {
  nickname: string
  /** Avatar ID, not a URL: a re-upload must not reassign someone's face. */
  avatarId: string | null
  /**
   * Earned badges and redemption are keyed by campaign id, NOT global. A flat
   * list let a returning fan carry hunt A's badges into hunt B — inflating the
   * count so /redeem could show "you won" off the wrong hunt. Now switching the
   * live hunt starts that hunt clean.
   */
  earned: Record<string, string[]>
  claimed: Record<string, boolean>
  wonHunts: WonHunt[]
}

function parseWonHunts(value: unknown): WonHunt[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(
      (h): h is WonHunt =>
        typeof h === 'object' &&
        h !== null &&
        typeof (h as WonHunt).campaignId === 'string' &&
        typeof (h as WonHunt).name === 'string' &&
        typeof (h as WonHunt).wonAt === 'number',
    )
    .map((h) => ({
      campaignId: h.campaignId,
      name: h.name,
      wonAt: h.wonAt,
      // Optional provenance; drop anything that isn't a plain string.
      ...(typeof h.tenantSlug === 'string' ? { tenantSlug: h.tenantSlug } : {}),
    }))
}

function parseEarned(value: unknown): Record<string, string[]> {
  if (typeof value !== 'object' || value === null) return {}
  const out: Record<string, string[]> = {}
  for (const [id, list] of Object.entries(value)) {
    if (Array.isArray(list)) out[id] = list.filter((x): x is string => typeof x === 'string')
  }
  return out
}

function parseClaimed(value: unknown): Record<string, boolean> {
  if (typeof value !== 'object' || value === null) return {}
  const out: Record<string, boolean> = {}
  for (const [id, v] of Object.entries(value)) if (v === true) out[id] = true
  return out
}

/**
 * Merge helpers for reconciling this device's progress with the account copy
 * pulled from the server. The rule everywhere is UNION, never clobber: a fan
 * who played as a guest and then signed in must keep both sides — losing a
 * trophy to a sync is worse than the sync not existing.
 */
function mergeEarned(
  a: Record<string, string[]>,
  b: Record<string, string[]>,
): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    out[id] = [...new Set([...(a[id] ?? []), ...(b[id] ?? [])])]
  }
  return out
}

function mergeClaimed(
  a: Record<string, boolean>,
  b: Record<string, boolean>,
): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (a[id] === true || b[id] === true) out[id] = true
  }
  return out
}

function mergeWonHunts(a: WonHunt[], b: WonHunt[]): WonHunt[] {
  const byId = new Map<string, WonHunt>()
  for (const hunt of [...a, ...b]) {
    const existing = byId.get(hunt.campaignId)
    // Keep the EARLIEST win: the first time this hunt was actually finished,
    // not whichever device happened to sync last.
    if (!existing || hunt.wonAt < existing.wonAt) byId.set(hunt.campaignId, hunt)
  }
  return [...byId.values()]
}

function load(): PersistedProgress {
  const empty: PersistedProgress = {
    nickname: '',
    avatarId: null,
    earned: {},
    claimed: {},
    wonHunts: [],
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return empty
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return {
      nickname: typeof parsed.nickname === 'string' ? parsed.nickname : '',
      // Avatars used to be emoji. An old value is not an ID of anything,
      // so it resolves to the monogram rather than a broken image.
      avatarId: typeof parsed.avatarId === 'string' ? parsed.avatarId : null,
      // Old saves had a flat `earnedIds`/`redeemed` with no campaign to attach
      // them to — they are dropped on migration rather than mis-assigned. The
      // name, avatar and trophy shelf survive.
      earned: parseEarned(parsed.earned),
      claimed: parseClaimed(parsed.claimed),
      wonHunts: parseWonHunts(parsed.wonHunts),
    }
  } catch {
    // Corrupt or unavailable storage — start clean rather than crash on boot.
    return empty
  }
}

export type { WonHunt }

/**
 * The fan's session: who they are and what they've collected.
 *
 * SEAM: this is device-local by design for now, which means a fan who
 * switches phones or clears data loses progress, and the claim code is
 * trivially forgeable. Both are acceptable for a shell and unacceptable for
 * a real prize — server-side sessions are a prerequisite for redemption.
 */
export const useProgressStore = defineStore('progress', () => {
  const session = useSessionStore()
  const missionsStore = useMissionsStore()
  const initial = load()

  const nickname = ref(initial.nickname)
  const avatarId = ref<string | null>(initial.avatarId)
  /** Per-campaign badge sets and redemption. Dev tooling writes these directly. */
  const earned = ref<Record<string, string[]>>(initial.earned)
  const claimed = ref<Record<string, boolean>>(initial.claimed)
  const wonHunts = ref<WonHunt[]>(initial.wonHunts)

  /** The hunt in play. Everything current-hunt is scoped to this. */
  const campaignId = computed(() => missionsStore.campaignId)

  const hasProfile = computed(() => nickname.value.trim().length >= 2)

  const earnedIds = computed(() => earned.value[campaignId.value] ?? [])
  const redeemed = computed(() => claimed.value[campaignId.value] === true)
  const earnedCount = computed(() => earnedIds.value.length)
  // The CAMPAIGN is authoritative for how many badges win, not tenant config —
  // the server ships badgeTarget alongside the missions, and a trophy case
  // showing six slots while /redeem unlocks at five is the kind of bug a fan
  // notices at the counter.
  const isComplete = computed(() => earnedCount.value >= missionsStore.badgeTarget)
  const remaining = computed(() => Math.max(0, missionsStore.badgeTarget - earnedCount.value))

  const hasBadge = computed(() => (id: string) => earnedIds.value.includes(id))

  /** Won hunts, newest first — the trophy shelf. */
  const trophies = computed(() => [...wonHunts.value].sort((a, b) => b.wonAt - a.wonAt))

  /**
   * Four-digit claim code, derived from the DEVICE ID so it is stable across
   * reloads without needing a server round trip.
   *
   * SEAM: derived, not issued — anyone can compute another fan's code. A real
   * deployment must have the server mint and invalidate these.
   */
  const claimCode = computed(() => {
    let hash = 7
    // Prefer the account uid when signed in: it is stable across a browser
    // reinstall, where the device id is not.
    for (const ch of `${session.user?.uid ?? session.deviceId}`) {
      hash = (hash * 31 + ch.charCodeAt(0)) % 10000
    }
    return String(hash).padStart(4, '0')
  })

  function setProfile(name: string, nextAvatarId: string | null): void {
    nickname.value = name.trim()
    avatarId.value = nextAvatarId
  }

  /** Idempotent: re-capturing a mission must not inflate the badge count. */
  function awardBadge(missionId: string): void {
    const id = campaignId.value
    const list = earned.value[id] ?? []
    if (list.includes(missionId)) return
    earned.value = { ...earned.value, [id]: [...list, missionId] }
  }

  /** Marks the current hunt's prize as redeemed on this device. */
  function markRedeemed(): void {
    claimed.value = { ...claimed.value, [campaignId.value]: true }
  }

  /**
   * Records a finished hunt as a trophy. Idempotent per hunt: completing the
   * same hunt again (or a reload while complete) must not add a second trophy.
   * The seed/fallback hunt is skipped by the caller — it has no real name.
   */
  function recordWin(id: string, huntName: string, tenantSlug?: string): void {
    if (!id || wonHunts.value.some((h) => h.campaignId === id)) return
    wonHunts.value = [
      ...wonHunts.value,
      {
        campaignId: id,
        name: huntName,
        wonAt: Date.now(),
        ...(tenantSlug ? { tenantSlug } : {}),
      },
    ]
  }

  function reset(): void {
    nickname.value = ''
    avatarId.value = null
    earned.value = {}
    claimed.value = {}
    wonHunts.value = []
  }

  // ── Cross-device sync (signed-in fans only) ──────────────────────────
  // Progress is device-local for guests. A signed-in fan gets it made durable
  // under their uid so trophies follow them to a new phone. This is the fan's
  // OWN self-reported progress — continuity, not a trusted ledger — so it
  // never gains authority a forgeable localStorage value did not already have.
  // See stores/session.ts, firebase helpers/fanProgress.ts, docs/architecture.

  function currentPayload(): PersistedProgress {
    return {
      nickname: nickname.value,
      avatarId: avatarId.value,
      earned: earned.value,
      claimed: claimed.value,
      wonHunts: wonHunts.value,
    }
  }

  /** Fire-and-forget: a fan must never wait on, or fail because of, a sync. */
  async function pushToAccount(): Promise<void> {
    const token = await session.getIdToken()
    if (!token) return
    void apiFetch(PROGRESS_ENDPOINT, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(currentPayload()),
    })
  }

  let pushTimer: ReturnType<typeof setTimeout> | null = null
  /** Coalesce the burst of writes from awarding a badge (or a merge) into one
   *  request — 800ms is imperceptible and collapses a five-badge spree. */
  function schedulePush(): void {
    if (pushTimer) clearTimeout(pushTimer)
    pushTimer = setTimeout(() => {
      pushTimer = null
      void pushToAccount()
    }, 800)
  }

  // Clear a pending debounce if the store's scope is torn down (tests, HMR)
  // so the timer can't fire against a disposed store.
  onScopeDispose(() => {
    if (pushTimer) clearTimeout(pushTimer)
  })

  /**
   * On sign-in: pull the account copy, MERGE it into whatever is on this
   * device (never clobber — a guest who then signs in keeps both sides), then
   * push the reconciled result so the server and every device converge. The
   * merge also covers first sign-in: the server has nothing, so this device's
   * play is uploaded as-is.
   */
  async function hydrateFromAccount(): Promise<void> {
    const token = await session.getIdToken()
    if (!token) return

    const result = await apiFetch<{ progress: unknown }>(PROGRESS_ENDPOINT, {
      headers: { Authorization: `Bearer ${token}` },
    })
    // A failed pull must not wipe local progress or upload a half-read state.
    if (!result.ok) return

    const remote = result.data.progress
    if (remote && typeof remote === 'object') {
      // Parse defensively with the same helpers used for localStorage — a doc
      // from an older shape is coerced, never trusted whole.
      const r = remote as Record<string, unknown>
      nickname.value = nickname.value.trim() || (typeof r.nickname === 'string' ? r.nickname : '')
      avatarId.value = avatarId.value ?? (typeof r.avatarId === 'string' ? r.avatarId : null)
      earned.value = mergeEarned(earned.value, parseEarned(r.earned))
      claimed.value = mergeClaimed(claimed.value, parseClaimed(r.claimed))
      wonHunts.value = mergeWonHunts(wonHunts.value, parseWonHunts(r.wonHunts))
    }

    // Explicit (not scheduled): converge immediately, and cover the empty-server
    // first-sign-in case where no ref changed and the watch below would not fire.
    void pushToAccount()
  }

  // Hydrate when a real fan account becomes active — never for guests (no uid)
  // and never for admins (staff testing is not a fan session). Fires when the
  // async auth listener resolves the account after boot.
  watch(
    () => (session.isFan ? (session.user?.uid ?? null) : null),
    (uid) => {
      if (uid) void hydrateFromAccount()
    },
    { immediate: true },
  )

  // The moment the badge target is first reached on a real published hunt:
  // report the aggregate completion, and keep the hunt as a trophy. Fires only
  // on the false→true transition; reportFanEvent and recordWin are both
  // idempotent, so a reload while already complete does not double-count.
  // Requires a real campaign id — there is no hunt to win when none is
  // published.
  watch(isComplete, (complete) => {
    if (complete && missionsStore.loaded && missionsStore.campaignId && missionsStore.slug) {
      reportFanEvent(missionsStore.slug, missionsStore.campaignId, 'completion')
      recordWin(missionsStore.campaignId, missionsStore.name, missionsStore.slug)
    }
  })

  watch(
    [nickname, avatarId, earned, claimed, wonHunts],
    () => {
      const payload: PersistedProgress = {
        nickname: nickname.value,
        avatarId: avatarId.value,
        earned: earned.value,
        claimed: claimed.value,
        wonHunts: wonHunts.value,
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
      } catch {
        // Private browsing. Progress stays in memory for this session.
      }

      // A signed-in fan's progress also lives on the server, so it survives a
      // new phone. Debounced and fire-and-forget; guests never reach here.
      if (session.isFan) schedulePush()
    },
    { deep: true },
  )

  return {
    nickname,
    avatarId,
    earned,
    claimed,
    wonHunts,
    hasProfile,
    earnedIds,
    redeemed,
    earnedCount,
    isComplete,
    remaining,
    hasBadge,
    trophies,
    claimCode,
    setProfile,
    awardBadge,
    markRedeemed,
    recordWin,
    reset,
  }
})
