import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { tenant } from '../config/tenant'
import { useMissionsStore } from './missions'

const STORAGE_KEY = 'photo-hunt:progress'

interface PersistedProgress {
  nickname: string
  avatar: string
  earnedIds: string[]
  redeemed: boolean
}

function load(): PersistedProgress {
  const empty: PersistedProgress = { nickname: '', avatar: '', earnedIds: [], redeemed: false }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return empty
    const parsed = JSON.parse(raw) as Partial<PersistedProgress>
    return {
      nickname: typeof parsed.nickname === 'string' ? parsed.nickname : '',
      avatar: typeof parsed.avatar === 'string' ? parsed.avatar : '',
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
  const initial = load()

  const nickname = ref(initial.nickname)
  const avatar = ref(initial.avatar || tenant.avatars[0])
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
   * Four-digit claim code, derived from the nickname so it is stable across
   * reloads without needing a server round trip.
   *
   * SEAM: derived, not issued — anyone can compute another fan's code. A real
   * deployment must have the server mint and invalidate these.
   */
  const claimCode = computed(() => {
    let hash = 7
    for (const ch of `${nickname.value}|${tenant.teamName}`) {
      hash = (hash * 31 + ch.charCodeAt(0)) % 10000
    }
    return String(hash).padStart(4, '0')
  })

  function setProfile(name: string, avatarId: string): void {
    nickname.value = name.trim()
    avatar.value = avatarId
  }

  /** Idempotent: re-capturing a mission must not inflate the badge count. */
  function awardBadge(missionId: string): void {
    if (earnedIds.value.includes(missionId)) return
    earnedIds.value = [...earnedIds.value, missionId]
  }

  function reset(): void {
    nickname.value = ''
    avatar.value = tenant.avatars[0]
    earnedIds.value = []
    redeemed.value = false
  }

  watch(
    [nickname, avatar, earnedIds, redeemed],
    () => {
      const payload: PersistedProgress = {
        nickname: nickname.value,
        avatar: avatar.value,
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
    avatar,
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
