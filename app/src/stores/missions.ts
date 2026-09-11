import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { z } from 'zod'
import { apiFetch } from '../lib/api'
import { tenant } from '../config/tenant'

/**
 * Client-side mirror of `missionListSchema` in firebase/functions/src/models.ts.
 *
 * It is duplicated deliberately: the two packages have separate tsconfigs and
 * separate zod majors, and a shared package would be the third build target in
 * a scaffold that currently has two. Parse rather than cast, so a server change
 * surfaces as a loud validation error instead of `undefined` in a template.
 */
const missionSchema = z.object({
  id: z.string(),
  kind: z.enum(['photo', 'spyglass']),
  titleKey: z.string(),
  hintKey: z.string(),
  color: z.string(),
  imageUrl: z.string().url().nullable(),
})

const missionListSchema = z.object({
  campaignId: z.string(),
  badgeTarget: z.number().int().positive(),
  missions: z.array(missionSchema),
})

export type Mission = z.infer<typeof missionSchema>

/**
 * Offline fallback campaign.
 *
 * A stadium concourse is one of the worst RF environments a phone will ever
 * see — 30,000 people on one cell tower. The app must render something useful
 * when `GET /missions` times out, so it ships with the demo campaign baked in.
 */
const FALLBACK_MISSIONS: Mission[] = [
  { id: 'gate-statue', kind: 'photo', titleKey: 'missions.gateStatue.title', hintKey: 'missions.gateStatue.hint', color: '#3b6ea5', imageUrl: null },
  { id: 'west-concourse', kind: 'photo', titleKey: 'missions.westConcourse.title', hintKey: 'missions.westConcourse.hint', color: '#c7563f', imageUrl: null },
  { id: 'team-store', kind: 'photo', titleKey: 'missions.teamStore.title', hintKey: 'missions.teamStore.hint', color: '#4f8a63', imageUrl: null },
  { id: 'foul-pole', kind: 'photo', titleKey: 'missions.foulPole.title', hintKey: 'missions.foulPole.hint', color: '#8b6db3', imageUrl: null },
  { id: 'player-22', kind: 'spyglass', titleKey: 'missions.player22.title', hintKey: 'missions.player22.hint', color: '#d09a2c', imageUrl: null },
  { id: 'mascot', kind: 'spyglass', titleKey: 'missions.mascot.title', hintKey: 'missions.mascot.hint', color: '#2f8f9d', imageUrl: null },
]

export const useMissionsStore = defineStore('missions', () => {
  const missions = ref<Mission[]>([...FALLBACK_MISSIONS])
  const badgeTarget = ref(tenant.badgeTarget)
  const loading = ref(false)
  /** True when the list on screen is the baked-in fallback, not the server's. */
  const usingFallback = ref(true)

  const byId = computed(() => (id: string) => missions.value.find((m) => m.id === id) ?? null)

  /**
   * SEAM: `GET /missions` currently serves a constant from models.ts.
   * When it becomes a Firestore read, nothing here changes.
   */
  async function load(): Promise<void> {
    loading.value = true

    const result = await apiFetch<unknown>('/missions')

    if (result.ok) {
      const parsed = missionListSchema.safeParse(result.data)
      if (parsed.success) {
        missions.value = parsed.data.missions
        badgeTarget.value = parsed.data.badgeTarget
        usingFallback.value = false
        loading.value = false
        return
      }
      // Server reachable but shape wrong — a deploy skew bug, not a fan's
      // bad signal. Keep the fallback on screen and make it findable.
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

  return { missions, badgeTarget, loading, usingFallback, byId, load, shuffle }
})
