import * as logger from 'firebase-functions/logger'
import { isValidTenantSlug, type HuntRef, type HuntStatus, type HuntStatuses } from 'shared'
import { getPublishedMissionList } from './campaigns'
import { getTenant } from './tenant'

/** Per-slug answer: the published campaign id ('' when nothing is
 *  published), or null when the org is gone. */
type SlugState = string | null

/**
 * A short per-instance cache. Every fan's home asks this, and at a venue
 * thousands of them ask about the same one or two orgs within minutes; each
 * uncached slug is two Firestore reads. Thirty seconds of staleness only
 * delays a card's Continue appearing or disappearing — the hub itself always
 * reads live.
 */
const CACHE_TTL_MS = 30_000
const CACHE_MAX = 2_000
const cache = new Map<string, { state: SlugState; at: number }>()

async function slugState(slug: string): Promise<SlugState> {
  const hit = cache.get(slug)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.state

  // An address that could never have been an org is simply gone — and must
  // not reach a Firestore path.
  const state =
    !isValidTenantSlug(slug) || !(await getTenant(slug))
      ? null
      : (await getPublishedMissionList(slug)).campaignId

  // Bounded: a scripted caller cycling random slugs must not grow this
  // without limit. Oldest-inserted first is good enough for a 30s cache.
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string)
  cache.set(slug, { state, at: Date.now() })
  return state
}

/**
 * Can these saved "ongoing" cards still be continued?
 *
 * A fan's joined-hunt list is a snapshot taken on their device, so an org
 * that is removed, or a hunt that is unpublished or replaced, leaves a
 * Continue button pointing at "no team here". A card is `live` only when the
 * org exists AND the card's campaign is the one it currently publishes —
 * matching the campaign, not just the slug, so a freed address claimed by
 * someone else never turns an old card into a door to a stranger's hunt.
 *
 * Uses the same reads as the fan's hub (`getTenant` is the parse that makes
 * `/tenant` answer 404), so `live` means Continue lands on a playable hub and
 * `gone` means the hub would say "no team here".
 *
 * A slug whose read fails is left out of the answer rather than failing the
 * batch: the client leaves an unanswered card as it was and asks again later.
 */
export async function getHuntStatuses(hunts: HuntRef[]): Promise<HuntStatuses> {
  const slugs = [...new Set(hunts.map((h) => h.tenantSlug))]
  const settled = await Promise.allSettled(slugs.map(slugState))
  const states = new Map<string, SlugState>()
  settled.forEach((result, i) => {
    if (result.status === 'fulfilled') states.set(slugs[i], result.value)
    else logger.warn('hunt status read failed', { slug: slugs[i], err: result.reason })
  })

  return {
    statuses: hunts
      .filter((hunt) => states.has(hunt.tenantSlug))
      .map((hunt) => {
        const published = states.get(hunt.tenantSlug)
        const status: HuntStatus =
          published === null ? 'gone' : published === hunt.campaignId ? 'live' : 'ended'
        return { tenantSlug: hunt.tenantSlug, campaignId: hunt.campaignId, status }
      }),
  }
}
