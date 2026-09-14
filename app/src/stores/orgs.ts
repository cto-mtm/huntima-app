import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import {
  createdHuntSchema,
  myOrgsSchema,
  slugAvailabilitySchema,
  type CreatedHunt,
  type OrgSummary,
  type SlugAvailability,
} from 'shared'
import { authedFetch } from '../lib/authedFetch'
import { useSessionStore } from './session'

/** Why `create` refused. Each maps to its own sentence in the form. */
export type CreateFailure = 'taken' | 'rate-limited' | 'not-allowed' | 'error'

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
    loading.value = true
    error.value = null
    const result = await authedFetch<unknown>('/me/orgs')
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

  /**
   * Self-serve org creation (`POST /orgs`). Returns the outcome rather than
   * throwing so the form can show a specific message for the one expected
   * failure — the name being taken — apart from generic errors.
   */
  async function create(
    slug: string,
    teamName: string,
    // No `message`: the server's prose is logged for whoever is debugging,
    // never rendered. The form maps `reason` to copy a person can act on.
  ): Promise<{ ok: true } | { ok: false; reason: CreateFailure }> {
    const result = await authedFetch<unknown>('/orgs', {
      method: 'POST',
      body: JSON.stringify({ slug, teamName }),
    })

    if (!result.ok) {
      // Each status gets its own sentence, because "try again" is wrong advice
      // for most of them: 409 is a collision to edit, 429 the daily cap to
      // sleep off, 403 a refusal no amount of retrying will change (a server
      // still gating org creation on the operator claim answers this way).
      const reason: CreateFailure =
        result.status === 409
          ? 'taken'
          : result.status === 429
            ? 'rate-limited'
            : result.status === 403
              ? 'not-allowed'
              : 'error'
      // The server's own words, for whoever is debugging this. The form shows a
      // sentence a person can act on; the reason it actually failed should not
      // have to be guessed from that sentence.
      console.error('[orgs] create failed', { status: result.status, error: result.error })
      return { ok: false, reason }
    }

    // Refresh so the router guard and any org lists see the new membership.
    await load()
    return { ok: true }
  }

  /**
   * Is this web address free? Asked while the organizer is still typing, so a
   * taken or reserved name is a correction rather than a rejection after they
   * have committed to it.
   *
   * Returns null when the question could not be answered — offline, or the
   * probe's own rate limit. A null must read as "we don't know yet" in the UI
   * and never as "available": the create call is the real judge, and it
   * resolves a collision atomically server-side.
   */
  async function checkSlug(slug: string): Promise<SlugAvailability | null> {
    const result = await authedFetch<unknown>(
      `/orgs/slug-available?slug=${encodeURIComponent(slug)}`,
    )
    if (!result.ok) return null

    const parsed = slugAvailabilitySchema.safeParse(result.data)
    return parsed.success ? parsed.data : null
  }

  /**
   * Starts a hunt — the consumer path, and the one most people take.
   *
   * No organization, because a person running a wedding hunt is not founding
   * one. The server puts the draft in this account's personal space, creating
   * that space on the way through if it is their first. `handle` is only read
   * in that first case and is a suggestion, not a demand.
   */
  async function createHunt(
    name: string,
    handle?: string,
  ): Promise<{ ok: true; hunt: CreatedHunt } | { ok: false; reason: CreateFailure }> {
    const result = await authedFetch<unknown>('/me/hunts', {
      method: 'POST',
      body: JSON.stringify(handle ? { name, handle } : { name }),
    })

    if (!result.ok) {
      const reason: CreateFailure =
        result.status === 409
          ? 'taken'
          : result.status === 429
            ? 'rate-limited'
            : result.status === 403
              ? 'not-allowed'
              : 'error'
      console.error('[orgs] create hunt failed', { status: result.status, error: result.error })
      return { ok: false, reason }
    }

    const parsed = createdHuntSchema.safeParse(result.data)
    if (!parsed.success) {
      console.error('[orgs] unexpected /me/hunts payload', parsed.error.issues)
      return { ok: false, reason: 'error' }
    }

    // A first hunt creates the personal space, so the membership list is stale.
    if (parsed.data.createdSpace) await load()
    return { ok: true, hunt: parsed.data }
  }

  /** The account's own space, if it has started a hunt before. */
  const personalSlug = computed(() => orgs.value.find((o) => o.kind === 'personal')?.slug ?? null)
  /** Real organizations only — a personal space is not one, and must never be
   *  listed as one on a screen that says "your organizations". */
  const organizations = computed(() => orgs.value.filter((o) => o.kind !== 'personal'))

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

  return {
    orgs,
    organizations,
    personalSlug,
    loaded,
    loading,
    error,
    load,
    ensureLoaded,
    isMemberOf,
    create,
    createHunt,
    checkSlug,
  }
})
