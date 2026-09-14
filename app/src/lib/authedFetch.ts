import { apiFetch, type ApiResult } from './api'
import { useSessionStore } from '../stores/session'

/**
 * `apiFetch` with the caller's Firebase ID token attached.
 *
 * Four stores had grown their own copy of these six lines. They agreed today,
 * which is exactly why it was worth collapsing: the next change to how a token
 * is obtained (a forced refresh on 401, say) would have had to land in all
 * four, and would have landed in three.
 *
 * A missing token comes back as an ordinary failed `ApiResult`, not a throw,
 * so callers keep their single `if (!result.ok)` branch. It is a real state
 * rather than an error: a guest has no token, and several of these calls are
 * reachable the instant before auth has restored.
 */
export async function authedFetch<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  const session = useSessionStore()
  const token = await session.getIdToken()
  if (!token) return { ok: false, error: 'Not signed in' }

  return apiFetch<T>(path, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${token}` },
  })
}
