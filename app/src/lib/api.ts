/**
 * The only place in the app that reads VITE_API_URL or knows a URL shape.
 * Everything else goes through apiFetch() or useApi().
 */

// Emulator under the offline `demo-app` project id.
const DEV_FALLBACK = 'http://127.0.0.1:5001/demo-app/us-central1/api'
// REPLACE_ME — your deployed function URL.
const PROD_FALLBACK = 'https://us-central1-REPLACE_ME.cloudfunctions.net/api'

/**
 * Falling back rather than throwing means `npm run dev` works on a fresh
 * clone even if you forget `cp .env.example .env`.
 */
export const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? DEV_FALLBACK : PROD_FALLBACK)

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string }

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
        return { ok: false, error: `Bad JSON from ${path} (HTTP ${res.status})` }
      }
    }

    if (!res.ok) {
      const message =
        body && typeof body === 'object' && 'error' in body
          ? String((body as { error: unknown }).error)
          : `HTTP ${res.status}`
      return { ok: false, error: message }
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
