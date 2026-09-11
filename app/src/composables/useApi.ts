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

  async function execute(): Promise<void> {
    loading.value = true
    error.value = null

    const result = await apiFetch<T>(path, init)

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
