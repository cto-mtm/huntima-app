/**
 * The two hosting entries are your deployed web origins (Firebase Hosting
 * serves the app at both the .web.app and .firebaseapp.com domains).
 *
 * The last two entries are NOT optional and NOT dead weight:
 *   capacitor://localhost  — the Origin iOS WKWebView sends
 *   http://localhost       — the Origin Android WebView sends
 *
 * Delete them and the web app keeps working perfectly while every native
 * build fails every request with an opaque CORS error. Leave them in.
 */
const ALLOWED_ORIGINS = [
  'https://stadium-photo-hunt.web.app',
  'https://stadium-photo-hunt.firebaseapp.com',
  'http://localhost:5173',
  'capacitor://localhost',
  'http://localhost',
]

/**
 * IMPORTANT: this allow-list cannot be tested against the emulator.
 *
 * The Firebase Functions emulator wraps every function in its own
 * permissive CORS middleware that echoes whatever Origin it is given, and
 * it runs BEFORE this code. Locally you will therefore see
 * `access-control-allow-origin` come back for ANY origin — including ones
 * deliberately excluded here — and `vary: Origin` on requests that carry no
 * Origin at all. That is the emulator talking, not this file.
 *
 * Consequences:
 *  - A local curl against the emulator proves nothing about this list.
 *  - The dev server's port does not need to be in it; the emulator lets it
 *    through regardless of what is written here.
 *  - The list only takes effect on a DEPLOYED function. Verify it there.
 */

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

  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.set('Access-Control-Max-Age', '3600')

  if (req.method === 'OPTIONS') {
    res.status(204).send('')
    return true
  }

  return false
}
