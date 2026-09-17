import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { campaignFinisherSchema, type CampaignFinisher } from 'shared'

/**
 * The "who finished, and in what order" wall — SERVER-AUTHORITATIVE and
 * guest-inclusive.
 *
 * On every VERIFIED capture (`match === true`) the API calls `recordMatch`,
 * which tallies the distinct missions a participant has matched and stamps
 * `finishedAt` (server time) the instant that count first reaches the hunt's
 * `badgeTarget`. Because the server owns the tally, the order is what actually
 * happened here — not a self-report — and it includes guests: `participantId`
 * is a pseudonymous on-device id, which is the only handle a guest carries by
 * design (we collect nothing more).
 *
 * Honest limits (see docs/architecture.md § Seams): the id is client-supplied
 * (forgeable until server-ISSUED), and there is no contact channel — staff
 * match `deriveClaimCode(participantId)` at the counter rather than notifying.
 *
 * Layout: `tenants/{slug}/campaign_participants/{campaignId}/fans/{participantId}`.
 * One doc per participant per hunt. Written ONLY by the Admin SDK
 * (firestore.rules denies client writes), like the rest of the fan data.
 * `finishedAt` is WRITTEN ONLY once crossed — never as null — so the finisher
 * query (`orderBy('finishedAt')`) naturally excludes fans still in progress
 * and needs no composite index.
 */
function db(): Firestore {
  if (getApps().length === 0) initializeApp()
  return getFirestore()
}

function fansRef(slug: string, campaignId: string) {
  return db()
    .collection('tenants')
    .doc(slug)
    .collection('campaign_participants')
    .doc(campaignId)
    .collection('fans')
}

function campaignRef(slug: string, campaignId: string) {
  return db().collection('tenants').doc(slug).collection('campaigns').doc(campaignId)
}

/**
 * Record one verified match against a participant, and stamp the finish time
 * if this is the badge that completes the hunt.
 *
 * Runs in a transaction so the "did this cross the target" check and the
 * `finishedAt` stamp are atomic under the capture spike — two matches racing
 * to be the completing one resolve to a single, stable finish time. Idempotent
 * per mission: re-matching an already-earned mission leaves the set (and the
 * finish time) untouched, so a retry never re-orders the wall.
 *
 * Reads `badgeTarget` from the campaign doc inside the transaction. Called only
 * on a match, and the caller swallows errors — a ledger write must never fail
 * the verdict a fan is waiting on.
 */
export async function recordMatch(
  slug: string,
  campaignId: string,
  participantId: string,
  isGuest: boolean,
  missionId: string,
  now: number,
): Promise<void> {
  const ref = fansRef(slug, campaignId).doc(participantId)
  await db().runTransaction(async (tx) => {
    const [fanSnap, campaignSnap] = await Promise.all([tx.get(ref), tx.get(campaignRef(slug, campaignId))])
    if (!campaignSnap.exists) return

    const badgeTarget = Number((campaignSnap.data() as { badgeTarget?: unknown }).badgeTarget) || 0
    const data = fanSnap.data() as
      | { earned?: unknown; finishedAt?: unknown }
      | undefined
    const earned = new Set(Array.isArray(data?.earned) ? (data?.earned as string[]) : [])
    earned.add(missionId)

    // Preserve an existing finish time; only stamp the first crossing.
    const existingFinishedAt = typeof data?.finishedAt === 'number' ? data.finishedAt : null
    const finishedAt =
      existingFinishedAt ?? (badgeTarget > 0 && earned.size >= badgeTarget ? now : null)

    tx.set(
      ref,
      {
        participantId,
        isGuest,
        earned: [...earned],
        badgeCount: earned.size,
        updatedAt: now,
        // Only write the field once it exists — never null — so the finisher
        // query can key off its presence.
        ...(finishedAt !== null ? { finishedAt } : {}),
      },
      { merge: true },
    )
  })
}

/**
 * The finisher wall for one hunt, EARLIEST finish first — the order staff read
 * off for a first-to-finish prize. Only participants who crossed the target
 * appear (they are the only ones with a `finishedAt` field). Capped at 500;
 * parsed defensively so a stray malformed doc drops out rather than 500-ing.
 */
export async function listFinishers(
  slug: string,
  campaignId: string,
): Promise<CampaignFinisher[]> {
  const snap = await fansRef(slug, campaignId).orderBy('finishedAt', 'asc').limit(500).get()
  return snap.docs
    .map((doc) => campaignFinisherSchema.safeParse(doc.data()))
    .filter((r): r is { success: true; data: CampaignFinisher } => r.success)
    .map((r) => r.data)
}
