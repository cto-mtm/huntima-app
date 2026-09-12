import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { fanProgressSchema, type FanProgress } from 'shared'

/**
 * Per-fan progress, made durable so a signed-in fan's trophies follow them to a
 * new phone. One document per uid in `fan_progress/`.
 *
 * This is written ONLY through the authenticated `/me/progress` endpoint using
 * the Admin SDK — never by the client directly (firestore.rules denies all
 * client access to this path). But it is still the fan's OWN self-reported
 * progress: we store, keyed by their verified uid, what their client sends. It
 * is continuity, NOT a trusted ledger — it must never be the basis for handing
 * over a prize without staff verification. See docs/architecture.md § Seams and
 * the note on `fanProgressSchema` in `shared`.
 *
 * Unlike `campaign_stats`, this IS a per-person row — which is exactly why it
 * only exists for a fan who chose to sign in. A guest has no uid and never
 * reaches here; anonymous play stays device-local and unattributed.
 */
function db(): Firestore {
  if (getApps().length === 0) initializeApp()
  return getFirestore()
}

const COLLECTION = 'fan_progress'

/**
 * Returns the stored progress for a uid, or null if this fan has none yet
 * (a first sign-in, or a returning fan on a fresh device). Parses defensively:
 * a document written by an older shape must not 500 the fan's boot — it is
 * treated as absent so the client falls back to whatever is on the device.
 */
export async function getFanProgress(uid: string): Promise<FanProgress | null> {
  const doc = await db().collection(COLLECTION).doc(uid).get()
  if (!doc.exists) return null
  const parsed = fanProgressSchema.safeParse(doc.data())
  return parsed.success ? parsed.data : null
}

/**
 * Whole-document replace. The client merges the server copy with local state
 * before calling this, so the payload is already the reconciled truth — a
 * partial write here would let one device's stale view clobber the other's.
 */
export async function putFanProgress(uid: string, progress: FanProgress): Promise<void> {
  await db().collection(COLLECTION).doc(uid).set(progress)
}
