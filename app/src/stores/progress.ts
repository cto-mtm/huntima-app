import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useSessionStore } from './session'
import { useMissionsStore } from './missions'
import { reportFanEvent } from '../lib/analytics'

const STORAGE_KEY = 'photo-hunt:progress'

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
  return value.filter(
    (h): h is WonHunt =>
      typeof h === 'object' &&
      h !== null &&
      typeof (h as WonHunt).campaignId === 'string' &&
      typeof (h as WonHunt).name === 'string' &&
      typeof (h as WonHunt).wonAt === 'number',
  )
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
  function recordWin(id: string, huntName: string): void {
    if (!id || wonHunts.value.some((h) => h.campaignId === id)) return
    wonHunts.value = [...wonHunts.value, { campaignId: id, name: huntName, wonAt: Date.now() }]
  }

  function reset(): void {
    nickname.value = ''
    avatarId.value = null
    earned.value = {}
    claimed.value = {}
    wonHunts.value = []
  }

  // The moment the badge target is first reached on a real published hunt:
  // report the aggregate completion, and keep the hunt as a trophy. Fires only
  // on the false→true transition; reportFanEvent and recordWin are both
  // idempotent, so a reload while already complete does not double-count.
  // Requires a real campaign id — there is no hunt to win when none is
  // published.
  watch(isComplete, (complete) => {
    if (complete && missionsStore.loaded && missionsStore.campaignId) {
      reportFanEvent(missionsStore.campaignId, 'completion')
      recordWin(missionsStore.campaignId, missionsStore.name)
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
