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

const MODEL = 'gemini-2.5-flash'
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

/** Below this the capture is treated as a non-match. */
const MATCH_THRESHOLD = 0.6

function apiKey(): string | null {
  const key = process.env.GEMINI_API_KEY?.trim()
  return key ? key : null
}

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

function buildPrompt(mission: Mission): string {
  // Staff-authored hints describe the subject in the staff's own words, so
  // they are useful context. Seeded hints are i18n KEYS, not prose — passing
  // 'missions.mascot.hint' to a model would be worse than passing nothing.
  const hint = 'text' in mission.hint ? mission.hint.text : null

  return [
    'You are judging a stadium photo scavenger hunt played by families.',
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
 * @returns a verdict. Never throws — a model outage must not cost a fan their
 * badge-capture attempt with a 500.
 */
export async function verifyCapture(
  mission: Mission,
  captureBase64: string,
  captureMimeType: string,
): Promise<VerifyResult> {
  const key = apiKey()

  // ── Stub path ───────────────────────────────────────────────────────
  // No key, or no target to compare against. A mission with no target photo
  // is hint-only by design, so there is nothing to fail against.
  if (!key || !mission.targetImageUrl) {
    return {
      match: true,
      confidence: 0,
      reason: null,
      stubbed: true,
    }
  }

  const target = await fetchTarget(mission.targetImageUrl)
  if (!target) {
    // The target is unreachable — that is our failure, not the fan's. A
    // strict gate here would punish a child for a broken Storage URL.
    logger.warn('target image unreachable', { missionId: mission.id })
    return { match: true, confidence: 0, reason: null, stubbed: true }
  }

  try {
    const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: buildPrompt(mission) },
              { inline_data: { mime_type: target.mimeType, data: target.data } },
              { inline_data: { mime_type: captureMimeType, data: captureBase64 } },
            ],
          },
        ],
        generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      }),
    })

    if (!res.ok) {
      logger.error('gemini request failed', { status: res.status })
      return { match: true, confidence: 0, reason: null, stubbed: true }
    }

    const body = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
    }

    const raw = body.candidates?.[0]?.content?.parts?.[0]?.text
    if (!raw) return { match: true, confidence: 0, reason: null, stubbed: true }

    const verdict = JSON.parse(raw) as Partial<GeminiVerdict>
    const confidence = typeof verdict.confidence === 'number' ? verdict.confidence : 0
    const match = verdict.match === true && confidence >= MATCH_THRESHOLD

    return {
      match,
      confidence,
      reason: match ? null : (verdict.reason ?? null),
      stubbed: false,
    }
  } catch (err) {
    // Timeout, DNS, malformed JSON. Same reasoning as above: our problem,
    // so it must not read as the fan's mistake.
    logger.error('gemini verification error', { err })
    return { match: true, confidence: 0, reason: null, stubbed: true }
  }
}
