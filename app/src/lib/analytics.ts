import type { CampaignEventKind } from 'shared'
import { apiPost } from './api'

/**
 * Fan-side analytics reporting.
 *
 * Option A (see docs/architecture.md): the server keeps only aggregate
 * counters, never a per-person row. To approximate "how many people" without
 * handing the server a device id to store, the CLIENT dedups — it fires each
 * event at most once per device per hunt, remembering in localStorage that it
 * already did. Capture counts are recorded server-side instead, so they are
 * exact; these two are the "someone started / finished" signals the server
 * cannot observe on its own.
 *
 * Always fire-and-forget. A fan must never wait on, or fail because of, an
 * analytics write — they are here to play, not to be measured.
 */
// Keyed by campaignId alone: campaign ids are Firestore auto-ids, globally
// unique across orgs, so the dedup needs no tenant dimension.
function reportedKey(campaignId: string, kind: CampaignEventKind): string {
  return `huntima:reported:${kind}:${campaignId}`
}

export function reportFanEvent(slug: string, campaignId: string, kind: CampaignEventKind): void {
  // No campaign means there is no real hunt to attribute this to — the caller
  // guards on that, but belt and braces.
  if (!slug || !campaignId) return

  try {
    const key = reportedKey(campaignId, kind)
    if (localStorage.getItem(key)) return
    localStorage.setItem(key, '1')
  } catch {
    // Private browsing: we cannot dedup, so let the event through rather than
    // silently drop it. A small over-count beats a silent under-count.
  }

  void apiPost(`/t/${slug}/campaigns/${campaignId}/events`, { kind })
}
