/**
 * REPLACE_ME — swap the two example.com entries for your real domains.
 *
 * The last two entries are NOT optional and NOT dead weight:
 *   capacitor://localhost  — the Origin iOS WKWebView sends
 *   http://localhost       — the Origin Android WebView sends
 *
 * Delete them and the web app keeps working perfectly while every native
 * build fails every request with an opaque CORS error. Leave them in.
 */
const ALLOWED_ORIGINS = [
  'https://example.com',
  'https://www.example.com',
  'http://localhost:5173',
  'capacitor://localhost',
  'http://localhost',
]

// Structural types rather than imports from firebase-functions/v2/https:
// the exported Request/Response type names have moved between major
// versions, and this helper only needs these three members.
interface CorsRequest {
  method: string
  headers: Record<string, string | string[] | undefined>
}

interface CorsResponse {
  set(field: string, value: string): unknown
  status(code: number): { send(body: string): unknown }
}

/**
 * Applies CORS headers and handles the preflight.
 *
 * Returns `true` if the request has been fully handled (a preflight was
 * answered) and the caller should stop. Returns `false` to continue routing.
 */
export function applyCors(req: CorsRequest, res: CorsResponse): boolean {
  const origin = req.headers.origin

  if (typeof origin === 'string' && ALLOWED_ORIGINS.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin)
    // Responses vary by Origin, so any cache in front of this must key on it.
    res.set('Vary', 'Origin')
  }

  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.set('Access-Control-Max-Age', '3600')

  if (req.method === 'OPTIONS') {
    res.status(204).send('')
    return true
  }

  return false
}
