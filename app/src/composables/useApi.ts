import { ref, shallowRef } from 'vue'
import { apiFetch } from '../lib/api'

/**
 * Ref-wrapped apiFetch for components that want loading / error state.
 *
 * `execute()` resolves rather than rejects — the result is in the refs.
 */
export function useApi<T>(path: string, init?: RequestInit) {
  const data = shallowRef<T | null>(null)
  const error = ref<string | null>(null)
  const loading = ref(false)

  // Monotonic token: only the MOST RECENT execute() may write the refs. Two
  // rapid calls (a double-click, or a re-fetch before the first lands) would
  // otherwise resolve in arbitrary order and let a stale response clobber a
  // fresh one. Each call captures its id and bails on write if it's been
  // superseded.
  let latest = 0

  async function execute(): Promise<void> {
    const token = ++latest
    loading.value = true
    error.value = null

    const result = await apiFetch<T>(path, init)

    // A newer execute() started while this one was in flight — discard.
    if (token !== latest) return

    if (result.ok) {
      data.value = result.data
    } else {
      error.value = result.error
      data.value = null
    }

    loading.value = false
  }

  return { data, error, loading, execute }
}
