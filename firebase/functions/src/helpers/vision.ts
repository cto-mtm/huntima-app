import * as logger from 'firebase-functions/logger'
import type { Mission, VerifyResult } from 'shared'

/**
 * Capture verification: does the fan's photo show the same thing as the
 * staff-uploaded target?
 *
 * Runs SERVER-SIDE ONLY, for two reasons. The API key would otherwise ship in
 * the bundle, and a key in a bundle is a key someone else spends. And the
 * verdict decides whether a prize gets handed over, so a client that grades
 * its own homework is a client that mints prizes.
 *
 * The fan's image is never written to storage — it arrives in the request,
 * goes to the model, and is discarded with the request. See storage.rules.
 *
 * ── Providing the key ──────────────────────────────────────────────────
 * Local:      put GEMINI_API_KEY=... in firebase/functions/.env  (gitignored)
 * Production: use a secret, not an env var —
 *               firebase functions:secrets:set GEMINI_API_KEY
 *             then add `secrets: ['GEMINI_API_KEY']` to the onRequest options
 *             in api.ts. It is read here the same way either way.
 *
 * With no key configured this returns a STUB verdict and says so, so the
 * whole flow is testable before anyone has an account.
 */

// Model pinned to a current release. Google retires older models for new API
// keys over time (a call to a retired model 404s with a "no longer available
// to new users" message), so this is expected to need occasional bumping —
// verify a candidate with GET /v1beta/models?key=… before changing it.
const MODEL = 'gemini-3.6-flash'
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

/** Below this the capture is treated as a non-match. */
const MATCH_THRESHOLD = 0.6

function apiKey(): string | null {
  const key = process.env.GEMINI_API_KEY?.trim()
  return key ? key : null
}

/**
 * Whether real model verification is configured. When false, every capture
 * gets the lenient stub verdict (auto-pass) — fine for local dev, but in
 * production it means the honor system is silently in effect. Surfaced on
 * GET /health so ops can catch a missing/blank secret before a fan does.
 */
export function isVerificationLive(): boolean {
  return apiKey() !== null
}

/** The model id in use, for operational visibility (never a secret). */
export const VERIFICATION_MODEL = MODEL

interface GeminiVerdict {
  match: boolean
  confidence: number
  reason: string
}

/**
 * Fetches the target image the staff uploaded. It lives in public Storage, so
 * no credentials are needed — but it is still a network hop inside a request
 * a fan is waiting on, hence the timeout.
 */
async function fetchTarget(url: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null

    const mimeType = res.headers.get('content-type') ?? 'image/jpeg'
    const buffer = Buffer.from(await res.arrayBuffer())
    return { data: buffer.toString('base64'), mimeType }
  } catch {
    return null
  }
}

/** Lenient fallback: a badge stands whenever WE couldn't judge (no key, our
 *  outage, a broken URL). A child must never lose a capture to our failure. */
function stub(): VerifyResult {
  return { match: true, confidence: 0, reason: null, stubbed: true }
}

/** Image-to-image: does the fan's photo show the same subject as the target? */
function buildImagePrompt(mission: Mission): string {
  // Staff-authored hints are prose and useful context. Seeded hints are i18n
  // KEYS — passing 'missions.mascot.hint' to a model is worse than nothing.
  const hint = 'text' in mission.hint ? mission.hint.text : null

  return [
    'You are judging a photo scavenger hunt played by families.',
    'The FIRST image is the target a staff member uploaded.',
    'The SECOND image is a photo a fan just took on their phone.',
    '',
    'Decide whether the fan photographed the same subject as the target.',
    'Judge the SUBJECT, not the photo quality. Fans shoot handheld, in bad',
    'light, at odd angles, from far away, often with people in the way.',
    'Different angle, distance, crop, blur or lighting is still a match.',
    'A different object, person or place is not.',
    ...(hint ? ['', `Staff described the target as: ${hint}`] : []),
    '',
    'Respond with ONLY a JSON object, no markdown fence:',
    '{"match": boolean, "confidence": number between 0 and 1, "reason": "one short sentence for a child"}',
  ].join('\n')
}

/**
 * Hint-only: no staged target photo, so judge the fan's photo against the
 * written description. This is what makes generic / generated missions ("a
 * player wearing glasses") real rather than auto-pass. Deliberately lenient —
 * a scavenger hunt should feel winnable, not like an exam.
 */
function buildHintPrompt(hint: string): string {
  return [
    'You are judging a photo scavenger hunt played by families.',
    'The image is a photo a fan just took on their phone.',
    '',
    `Decide whether the photo plausibly shows: ${hint}`,
    'Judge the SUBJECT, not the photo quality. Fans shoot handheld, in bad',
    'light, at odd angles, from far away, often with people in the way.',
    'Give the fan the benefit of the doubt: if it reasonably shows what was',
    'asked, it is a match. Only reject a clearly unrelated photo.',
    '',
    'Respond with ONLY a JSON object, no markdown fence:',
    '{"match": boolean, "confidence": number between 0 and 1, "reason": "one short sentence for a child"}',
  ].join('\n')
}

type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } }

/** Runs one generateContent call and turns it into a verdict. Never throws. */
async function runVerdict(key: string, parts: GeminiPart[]): Promise<VerifyResult> {
  try {
    const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      }),
    })

    if (!res.ok) {
      logger.error('gemini request failed', { status: res.status })
      return stub()
    }

    const body = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
    }

    const raw = body.candidates?.[0]?.content?.parts?.[0]?.text
    if (!raw) return stub()

    const verdict = JSON.parse(raw) as Partial<GeminiVerdict>

    // Clamp: this is model output, and verifyResultSchema requires 0-1. A
    // model that answers 1.5 must not turn into a 500 for the fan.
    const rawConfidence = typeof verdict.confidence === 'number' ? verdict.confidence : 0
    const confidence = Math.min(1, Math.max(0, rawConfidence))
    const match = verdict.match === true && confidence >= MATCH_THRESHOLD

    return { match, confidence, reason: match ? null : (verdict.reason ?? null), stubbed: false }
  } catch (err) {
    // Timeout, DNS, malformed JSON. Our problem, so it must not read as the
    // fan's mistake.
    logger.error('gemini verification error', { err })
    return stub()
  }
}

/**
 * @returns a verdict. Never throws — a model outage must not cost a fan their
 * badge-capture attempt with a 500.
 */
export async function verifyCapture(
  mission: Mission,
  captureBase64: string,
  captureMimeType: string,
): Promise<VerifyResult> {
  const key = apiKey()
  if (!key) return stub() // no key → honor system, and it says so on the client

  const capturePart = { inline_data: { mime_type: captureMimeType, data: captureBase64 } }

  // ── Image-to-image ──────────────────────────────────────────────────
  if (mission.targetImageUrl) {
    const target = await fetchTarget(mission.targetImageUrl)
    if (!target) {
      // The target is unreachable — our failure, not the fan's. A strict gate
      // here would punish a child for a broken Storage URL.
      logger.warn('target image unreachable', { missionId: mission.id })
      return stub()
    }
    return runVerdict(key, [
      { text: buildImagePrompt(mission) },
      { inline_data: { mime_type: target.mimeType, data: target.data } },
      capturePart,
    ])
  }

  // ── Hint-only ───────────────────────────────────────────────────────
  // No staged target. Judge against the written hint — but only staff prose,
  // never an i18n key (the seed demo). A key means we have nothing to check.
  const hint = 'text' in mission.hint ? mission.hint.text : null
  if (!hint) return stub()
  return runVerdict(key, [{ text: buildHintPrompt(hint) }, capturePart])
}
