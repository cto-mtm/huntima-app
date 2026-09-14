import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore'
import * as logger from 'firebase-functions/logger'

/**
 * A small, self-contained fixed-window rate limiter backed by Firestore.
 *
 * WHY THIS EXISTS
 * `POST /verify-capture` is unauthenticated (fans are anonymous) and each call
 * fans out to a PAID vision model on a ~1 MB image. The public campaign/mission
 * ids are all an attacker needs, so without a limit a single client can drive
 * unbounded model spend and egress; `maxInstances` caps concurrency, not total
 * cost. This puts a hard ceiling on calls per caller per window.
 *
 * DESIGN
 * One document per (bucket, key, window) in `rate_limits/`. A transaction reads
 * the current count and increments it, so concurrent requests can't slip past
 * the ceiling by racing a read. Windows are derived from the clock (no cleanup
 * job needed for correctness); a scheduled TTL on the collection is the tidy-up.
 *
 * FAIL OPEN, NOT CLOSED
 * If the limiter's OWN storage errors, we allow the request. A fan at a game
 * must never lose a capture to our bookkeeping — the limiter guards our wallet,
 * not the fan's badge, and a vision outage already fails safe to the stub.
 */
function db(): Firestore {
  if (getApps().length === 0) initializeApp()
  return getFirestore()
}

const COLLECTION = 'rate_limits'

export interface RateLimitResult {
  allowed: boolean
  /** Remaining calls in the current window (0 when blocked). */
  remaining: number
  /** Seconds until the window resets — for a Retry-After header. */
  retryAfterSeconds: number
}

export interface RateLimitOptions {
  /** Namespaces the counter, e.g. 'verify-capture'. */
  bucket: string
  /** The caller identity to limit on (IP, uid, or a composite). */
  key: string
  /** Max calls permitted per window. */
  limit: number
  /** Window length in seconds. */
  windowSeconds: number
}

/**
 * Records one hit against `(bucket, key)` and reports whether it is allowed.
 * Call once per request; a blocked result means the caller is over the limit
 * for the current window.
 */
export async function rateLimit(opts: RateLimitOptions): Promise<RateLimitResult> {
  const { bucket, key, limit, windowSeconds } = opts
  const nowMs = Date.now()
  const windowMs = windowSeconds * 1000
  const windowStart = Math.floor(nowMs / windowMs) * windowMs
  const resetMs = windowStart + windowMs
  const retryAfterSeconds = Math.max(1, Math.ceil((resetMs - nowMs) / 1000))

  // Sanitize the key into a Firestore-safe doc id segment. IPs and uids are
  // already tame, but a stray '/' would silently create a subcollection path.
  const safeKey = key.replace(/[^A-Za-z0-9._:-]/g, '_').slice(0, 200)
  const docId = `${bucket}__${safeKey}__${windowStart}`
  const ref = db().collection(COLLECTION).doc(docId)

  try {
    return await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      const count = snap.exists ? Number(snap.data()?.count ?? 0) : 0

      if (count >= limit) {
        return { allowed: false, remaining: 0, retryAfterSeconds }
      }

      tx.set(
        ref,
        {
          count: count + 1,
          // Stored so a scheduled TTL policy can reap stale windows; not read
          // by this code path.
          expireAt: Timestamp.fromMillis(resetMs + windowMs),
        },
        { merge: true },
      )

      return { allowed: true, remaining: limit - (count + 1), retryAfterSeconds }
    })
  } catch (err) {
    // Fail OPEN: the limiter protects cost, not correctness. Losing the
    // counter must not cost a fan their capture.
    logger.warn('rate limiter unavailable, allowing request', { bucket, err })
    return { allowed: true, remaining: limit, retryAfterSeconds }
  }
}

/** The slice of an Express-style response this helper writes. Structural, so
 *  it does not pin a firebase-functions major version. */
interface LimitedResponse {
  set(field: string, value: string): unknown
  status(code: number): { json(body: unknown): unknown }
}

/**
 * Records a hit and, when the caller is over the limit, answers 429 for you.
 *
 * Returns true when the request has been REJECTED and the caller should stop.
 * Every endpoint that guards its cost was repeating the same three lines —
 * set Retry-After, send 429, return — and the Retry-After header is exactly
 * the kind of detail that gets left out of the fourth copy. The message stays
 * per-endpoint because it is the only part that differs: "come back tomorrow"
 * and "please slow down" are not the same advice.
 */
export async function rateLimitOrReject(
  res: LimitedResponse,
  opts: RateLimitOptions,
  message: string,
): Promise<boolean> {
  const gate = await rateLimit(opts)
  if (gate.allowed) return false

  res.set('Retry-After', String(gate.retryAfterSeconds))
  res.status(429).json({ error: message })
  return true
}

/**
 * Best-effort caller fingerprint for anonymous requests.
 *
 * Prefers the left-most address in `x-forwarded-for` (the original client as
 * seen by Google's front end), falling back to the socket ip. It is not
 * spoof-proof — a determined attacker rotates IPs — but it raises the cost of
 * casual abuse from "one loop" to "a botnet", which is the right bar for a
 * cost guard in front of a lenient, no-PII endpoint.
 */
export function callerIp(headers: Record<string, unknown>, socketIp?: string): string {
  const fwd = headers['x-forwarded-for']
  if (typeof fwd === 'string' && fwd.length > 0) {
    const first = fwd.split(',')[0]?.trim()
    if (first) return first
  }
  return socketIp && socketIp.length > 0 ? socketIp : 'unknown'
}
