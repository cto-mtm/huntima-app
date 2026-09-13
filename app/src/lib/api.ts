/**
 * The only place in the app that reads VITE_API_URL or knows a URL shape.
 * Everything else goes through apiFetch() or useApi().
 */

// Emulator under the offline `demo-app` project id.
const DEV_FALLBACK = 'http://127.0.0.1:6001/demo-app/us-central1/api'
// Deployed function URL (used only if VITE_API_URL is unset in a prod build).
const PROD_FALLBACK = 'https://us-central1-stadium-photo-hunt.cloudfunctions.net/api'

// Remote (CodePipe / Tailscale) dev: the app is served from ONE https origin
// and the browser cannot reach other localhost ports. The functions emulator
// is proxied by the dev server under its own path, so we use a same-origin
// RELATIVE base. VITE_TAILSCALE_HOST is injected by vite.config.ts only when
// the `dev:remote` script sets TAILSCALE_HOST.
const REMOTE_FALLBACK = '/demo-app/us-central1/api'
const isRemote = Boolean(import.meta.env.VITE_TAILSCALE_HOST)

/**
 * Falling back rather than throwing means `npm run dev` works on a fresh
 * clone even if you forget `cp .env.example .env`.
 *
 * In remote mode the relative base always wins over VITE_API_URL, because an
 * absolute localhost URL would break the single-origin rule on a phone.
 */
export const API_BASE_URL = isRemote
  ? REMOTE_FALLBACK
  : (import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? DEV_FALLBACK : PROD_FALLBACK))

/**
 * True when the API we are pointed at is a local emulator rather than a
 * deployed function. Used to gate dev-only tooling — see src/dev/.
 *
 * Note this is NOT a security boundary on its own; `import.meta.env.DEV` is.
 * Vite replaces that with the literal `false` in a production build, so the
 * dev tooling is eliminated at build time rather than merely hidden.
 */
export const IS_LOCAL_API =
  API_BASE_URL.startsWith('/') ||
  API_BASE_URL.includes('127.0.0.1:6001') ||
  API_BASE_URL.includes('localhost:6001')

export type ApiResult<T> =
  | { ok: true; data: T }
  // `status` is present for HTTP failures and absent for network ones, so a
  // caller can tell "the server said 404" (an unknown org) from "no signal".
  | { ok: false; error: string; status?: number }

/**
 * JSON in, JSON out. Never throws — every failure (network, non-2xx, bad
 * JSON) comes back as `{ ok: false, error }` so callers can't forget a
 * try/catch and ship a white screen to a stadium.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`

  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    })

    const text = await res.text()
    let body: unknown = null
    if (text) {
      try {
        body = JSON.parse(text)
      } catch {
        return { ok: false, error: `Bad JSON from ${path} (HTTP ${res.status})`, status: res.status }
      }
    }

    if (!res.ok) {
      const message =
        body && typeof body === 'object' && 'error' in body
          ? String((body as { error: unknown }).error)
          : `HTTP ${res.status}`
      return { ok: false, error: message, status: res.status }
    }

    return { ok: true, data: body as T }
  } catch (err) {
    // Thrown fetch = offline, DNS failure, or CORS rejection. A fan walking
    // a concrete concourse hits this constantly; it is a normal state.
    return { ok: false, error: err instanceof Error ? err.message : 'Network error' }
  }
}

/** Convenience wrapper for POST bodies. */
export function apiPost<T>(path: string, body: unknown): Promise<ApiResult<T>> {
  return apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) })
}
