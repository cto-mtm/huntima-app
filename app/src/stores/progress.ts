import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useSessionStore } from './session'
import { useMissionsStore } from './missions'

const STORAGE_KEY = 'photo-hunt:progress'

interface PersistedProgress {
  nickname: string
  /** Avatar ID, not a URL: a re-upload must not reassign someone's face. */
  avatarId: string | null
  earnedIds: string[]
  redeemed: boolean
}

function load(): PersistedProgress {
  const empty: PersistedProgress = { nickname: '', avatarId: null, earnedIds: [], redeemed: false }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return empty
    const parsed = JSON.parse(raw) as Partial<PersistedProgress>
    return {
      nickname: typeof parsed.nickname === 'string' ? parsed.nickname : '',
      // Avatars used to be emoji. An old value is not an ID of anything,
      // so it resolves to the monogram rather than a broken image.
      avatarId: typeof parsed.avatarId === 'string' ? parsed.avatarId : null,
      earnedIds: Array.isArray(parsed.earnedIds) ? parsed.earnedIds.filter((x) => typeof x === 'string') : [],
      redeemed: parsed.redeemed === true,
    }
  } catch {
    // Corrupt or unavailable storage — start clean rather than crash on boot.
    return empty
  }
}

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
  const initial = load()

  const nickname = ref(initial.nickname)
  const avatarId = ref<string | null>(initial.avatarId)
  const earnedIds = ref<string[]>(initial.earnedIds)
  const redeemed = ref(initial.redeemed)

  const hasProfile = computed(() => nickname.value.trim().length >= 2)
  const earnedCount = computed(() => earnedIds.value.length)
  // The CAMPAIGN is authoritative for how many badges win, not tenant
  // config — the server ships badgeTarget alongside the missions, and a
  // trophy case showing six slots while /redeem unlocks at five is the
  // kind of bug a fan notices at the counter. tenant.badgeTarget is only
  // the pre-fetch default, held by the missions store.
  const missionsStore = useMissionsStore()
  const isComplete = computed(() => earnedCount.value >= missionsStore.badgeTarget)
  const remaining = computed(() => Math.max(0, missionsStore.badgeTarget - earnedCount.value))

  const hasBadge = computed(() => (id: string) => earnedIds.value.includes(id))

  /**
   * Four-digit claim code, derived from the DEVICE ID so it is stable
   * across reloads without needing a server round trip.
   *
   * It deliberately does not depend on the team name. It used to, which
   * meant an admin renaming the club in the dashboard silently reissued
   * every outstanding code — a fan holding 7291 at the counter would watch
   * it become something else while a staff member was editing branding.
   *
   * SEAM: derived, not issued — anyone can compute another fan's code. A real
   * deployment must have the server mint and invalidate these.
   */
  const claimCode = computed(() => {
    let hash = 7
    for (const ch of `${session.deviceId}|${nickname.value}`) {
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
    if (earnedIds.value.includes(missionId)) return
    earnedIds.value = [...earnedIds.value, missionId]
  }

  function reset(): void {
    nickname.value = ''
    avatarId.value = null
    earnedIds.value = []
    redeemed.value = false
  }

  watch(
    [nickname, avatarId, earnedIds, redeemed],
    () => {
      const payload: PersistedProgress = {
        nickname: nickname.value,
        avatarId: avatarId.value,
        earnedIds: earnedIds.value,
        redeemed: redeemed.value,
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
    earnedIds,
    redeemed,
    hasProfile,
    earnedCount,
    isComplete,
    remaining,
    hasBadge,
    claimCode,
    setProfile,
    awardBadge,
    reset,
  }
})
