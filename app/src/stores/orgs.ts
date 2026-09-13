import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { myOrgsSchema, type OrgSummary } from 'shared'
import { apiFetch } from '../lib/api'
import { useSessionStore } from './session'

/**
 * The orgs this account can open — `GET /me/orgs`, the org picker's data.
 *
 * Client-side convenience only: the router guard uses it to route someone to
 * the right console, but the REAL gate is `requireMember` in the API. A
 * client that fakes this list gets a console whose every call 403s.
 *
 * Operators (the `admin` claim) get every org back from the server, so
 * `isMemberOf` is true across the board for them without a special case.
 */
export const useOrgsStore = defineStore('orgs', () => {
  const session = useSessionStore()

  const orgs = ref<OrgSummary[]>([])
  const loaded = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function load(): Promise<void> {
    const token = await session.getIdToken()
    if (!token) {
      orgs.value = []
      loaded.value = false
      return
    }

    loading.value = true
    error.value = null
    const result = await apiFetch<unknown>('/me/orgs', {
      headers: { Authorization: `Bearer ${token}` },
    })
    loading.value = false

    if (!result.ok) {
      error.value = result.error
      return
    }

    const parsed = myOrgsSchema.safeParse(result.data)
    if (!parsed.success) {
      console.error('[orgs] unexpected /me/orgs payload', parsed.error.issues)
      error.value = 'Unexpected response'
      return
    }

    orgs.value = parsed.data.orgs
    loaded.value = true
  }

  async function ensureLoaded(): Promise<void> {
    if (!loaded.value) await load()
  }

  function isMemberOf(slug: string): boolean {
    return orgs.value.some((o) => o.slug === slug)
  }

  // A sign-out invalidates the list; the next console visit refetches under
  // whichever account signs in next.
  watch(
    () => session.user,
    (user) => {
      if (!user) {
        orgs.value = []
        loaded.value = false
      }
    },
  )

  return { orgs, loaded, loading, error, load, ensureLoaded, isMemberOf }
})
