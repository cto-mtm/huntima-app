import { defineStore } from 'pinia'
import { ref } from 'vue'
import { z } from 'zod'
import { orgMembersSchema, orgRoleSchema, type OrgMemberRow, type OrgRole } from 'shared'
import { authedFetch } from '../lib/authedFetch'
import { useTenantStore } from './tenant'

/** What `POST …/members` answers with: the uid the email resolved to. */
const addedMemberSchema = z.object({ uid: z.string().min(1).max(128), role: orgRoleSchema })

/**
 * The people who run the org the router has activated — `/t/:slug/admin/members`.
 *
 * There is no invitation flow: a colleague is added by the email their Huntima
 * account already uses, and the server refuses an address with no account. A
 * pending-invite state would mean an email pipeline, a token, and an expiry,
 * and none of that buys anything for the venue whose second staff member is
 * sitting at the next desk. That decision is worth revisiting when orgs are
 * onboarded remotely at scale, not before.
 *
 * Like every admin store here, nothing in this file is a security boundary:
 * `requireMember` gates reads and the owner check gates writes, server-side.
 */
export const useMembersStore = defineStore('members', () => {
  const tenant = useTenantStore()

  const members = ref<OrgMemberRow[]>([])
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  /** Which org the cached list belongs to, so org A's team never shows inside
   *  org B's console — including for the beat before a fetch lands. */
  const forSlug = ref<string | null>(null)

  function base(): string {
    return `/t/${tenant.slug}/admin/members`
  }

  async function load(): Promise<void> {
    if (forSlug.value !== tenant.slug) {
      forSlug.value = tenant.slug
      members.value = []
    }

    loading.value = true
    error.value = null

    const result = await authedFetch<unknown>(base())
    loading.value = false

    if (!result.ok) {
      error.value = result.error
      return
    }

    const parsed = orgMembersSchema.safeParse(result.data)
    if (!parsed.success) {
      console.error('[members] unexpected payload', parsed.error.issues)
      error.value = 'Unexpected response'
      return
    }
    members.value = parsed.data.members
  }

  /**
   * Grants a seat. `no-account` is its own outcome because it is the common
   * mistake — a typo, or a colleague who has not signed up yet — and it needs
   * a different sentence from "that did not work".
   */
  async function add(
    email: string,
    role: OrgRole,
  ): Promise<
    { ok: true } | { ok: false; reason: 'no-account' | 'forbidden' | 'last-owner' | 'error' }
  > {
    saving.value = true
    const result = await authedFetch<unknown>(base(), {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    })
    saving.value = false

    if (!result.ok) {
      // 409 here means the add would demote the org's last owner — the same
      // invariant a remove refuses, reachable by re-adding the sole owner as an
      // editor.
      const reason =
        result.status === 404
          ? 'no-account'
          : result.status === 403
            ? 'forbidden'
            : result.status === 409
              ? 'last-owner'
              : 'error'
      return { ok: false, reason }
    }

    // Apply the row locally rather than refetching the list. The response
    // carries the uid the address resolved to, and the address is the one
    // just typed, so every field is known — a second round trip would only
    // fetch back what we already hold. Re-adding an existing member changes
    // their role, so replace rather than append.
    const parsed = addedMemberSchema.safeParse(result.data)
    if (parsed.success) {
      const row: OrgMemberRow = { uid: parsed.data.uid, email, role: parsed.data.role }
      members.value = [...members.value.filter((m) => m.uid !== row.uid), row]
    } else {
      await load()
    }
    return { ok: true }
  }

  /** Revokes a seat. `last-owner` is refused server-side, not here. */
  async function remove(
    uid: string,
  ): Promise<{ ok: true } | { ok: false; reason: 'last-owner' | 'forbidden' | 'error' }> {
    saving.value = true
    const result = await authedFetch<unknown>(`${base()}/${encodeURIComponent(uid)}`, {
      method: 'DELETE',
    })
    saving.value = false

    if (!result.ok) {
      const reason =
        result.status === 409 ? 'last-owner' : result.status === 403 ? 'forbidden' : 'error'
      return { ok: false, reason }
    }

    members.value = members.value.filter((m) => m.uid !== uid)
    return { ok: true }
  }

  return { members, loading, saving, error, load, add, remove }
})
