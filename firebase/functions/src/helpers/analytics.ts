import { getApps, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore, type Firestore } from 'firebase-admin/firestore'
import { campaignStatsSchema, type CampaignEventKind, type CampaignStats } from 'shared'

/**
 * Aggregate per-hunt analytics.
 *
 * One document per hunt in `campaign_stats/`, holding COUNTERS only — never a
 * per-person row. A fan is anonymous to us by design, and these are children at
 * a public venue; "how many / when" comes from sums, and "who" is not asked.
 * See the note on `campaignStatsSchema` in `shared`.
 *
 * All writes are `set(..., { merge: true })` with `FieldValue.increment`, so the
 * document is created on first event and every increment is atomic under
 * concurrent captures — which is exactly the traffic shape here, a spike when
 * the jumbotron shows the QR code.
 */
function db(): Firestore {
  if (getApps().length === 0) initializeApp()
  return getFirestore()
}

const COLLECTION = 'campaign_stats'

/** UTC hour bucket, e.g. `2026-09-12T19`. Rendered in the club tz client-side. */
function hourBucket(at: Date): string {
  return at.toISOString().slice(0, 13)
}

/**
 * Counted server-side on every capture verification, so it is exact. The hourly
 * bucket answers "when did they do it"; `matches` separates real badges from
 * attempts.
 */
export async function recordCapture(campaignId: string, matched: boolean, at: Date): Promise<void> {
  await db()
    .collection(COLLECTION)
    .doc(campaignId)
    .set(
      {
        captures: FieldValue.increment(1),
        matches: FieldValue.increment(matched ? 1 : 0),
        hours: { [hourBucket(at)]: FieldValue.increment(1) },
      },
      { merge: true },
    )
}

/**
 * Reported by the client, which fires each kind at most once per device per hunt
 * — so these approximate unique people without us storing the device ids that
 * would make them exact. An abusive client can inflate them; a real deployment
 * closes that with the anonymous-auth seam (see docs/architecture.md).
 */
export async function recordFanEvent(campaignId: string, kind: CampaignEventKind): Promise<void> {
  const field = kind === 'participant' ? 'participants' : 'completions'
  await db()
    .collection(COLLECTION)
    .doc(campaignId)
    .set({ [field]: FieldValue.increment(1) }, { merge: true })
}

const EMPTY: CampaignStats = { participants: 0, completions: 0, captures: 0, matches: 0, hours: {} }

export async function getCampaignStats(campaignId: string): Promise<CampaignStats> {
  const doc = await db().collection(COLLECTION).doc(campaignId).get()
  if (!doc.exists) return EMPTY
  // Parse defensively: a doc written by an older shape must not 500 the
  // dashboard. Missing counters fall back to zero via the spread.
  const parsed = campaignStatsSchema.safeParse({ ...EMPTY, ...doc.data() })
  return parsed.success ? parsed.data : EMPTY
}
