import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import {
  orgMemberSchema,
  planSchema,
  type OrgRole,
  type OrgMemberRow,
  type OrgSummary,
  type Plan,
  type TenantKind,
} from 'shared'

/**
 * Org membership: `tenants/{slug}/members/{uid}`.
 *
 * This is the authorization model for org consoles — a membership DOCUMENT,
 * not a claim (instant revoke, no size cap, checkable from security rules).
 * The global `admin` claim means PLATFORM OPERATOR and bypasses membership
 * everywhere; it is checked by the caller (`requireMember` in api.ts), not
 * here.
 */
function db(): Firestore {
  if (getApps().length === 0) initializeApp()
  return getFirestore()
}

function memberRef(slug: string, uid: string) {
  return db().collection('tenants').doc(slug).collection('members').doc(uid)
}

/** The caller's role in an org, or null when they are not a member. */
export async function getMembership(slug: string, uid: string): Promise<OrgRole | null> {
  const doc = await memberRef(slug, uid).get()
  if (!doc.exists) return null
  const parsed = orgMemberSchema.safeParse(doc.data())
  return parsed.success ? parsed.data.role : null
}

export type AddMemberResult = 'added' | 'last-owner'

/**
 * Grants or updates a membership.
 *
 * Runs in a transaction so it cannot defeat the last-owner invariant that
 * `removeMember` guards: re-adding the sole owner under a lesser role would
 * demote them and leave the org with nobody who can manage it — a state its
 * own customer cannot recover from. A role change preserves the original join
 * time; only a brand-new seat stamps a fresh `addedAt`.
 */
export async function addMember(
  slug: string,
  uid: string,
  role: OrgRole,
  addedBy: string,
): Promise<AddMemberResult> {
  const members = db().collection('tenants').doc(slug).collection('members')
  const target = members.doc(uid)

  return db().runTransaction(async (tx) => {
    const doc = await tx.get(target)
    const existing = doc.exists ? orgMemberSchema.safeParse(doc.data()) : null

    // Demoting the last owner is refused exactly as removing them is — two is
    // enough to answer "is this the last one".
    if (role !== 'owner' && existing?.success && existing.data.role === 'owner') {
      const owners = await tx.get(members.where('role', '==', 'owner').limit(2))
      if (owners.size <= 1) return 'last-owner' as const
    }

    const addedAt = existing?.success ? existing.data.addedAt : Date.now()
    const stampedBy = existing?.success ? existing.data.addedBy : addedBy
    tx.set(target, { uid, role, addedAt, addedBy: stampedBy })
    return 'added' as const
  })
}

/**
 * The org's team, with each member's current email resolved from Auth.
 *
 * A uid is not a person to the owner looking at this screen, so the console
 * needs addresses — and they are looked up rather than denormalised onto the
 * membership document, because a copied address is wrong the day someone
 * changes theirs. `getUsers` takes 100 identifiers per call, which is also the
 * cap on what this returns: an org with more staff than that has outgrown a
 * flat list and needs paging, not a silently truncated one.
 */
export async function listMembers(slug: string): Promise<OrgMemberRow[]> {
  const snap = await db().collection('tenants').doc(slug).collection('members').limit(100).get()

  const rows = snap.docs
    .map((d) => orgMemberSchema.safeParse(d.data()))
    .filter((r): r is { success: true; data: { uid: string; role: OrgRole; addedAt: number; addedBy: string } } => r.success)
    .map((r) => ({ uid: r.data.uid, role: r.data.role }))

  if (rows.length === 0) return []

  // One batched lookup, not one per member. A failure here degrades to "no
  // address" rather than an error page: knowing who runs the org is the point
  // of the screen, and a role list with blank emails still serves it.
  const emails = new Map<string, string | null>()
  try {
    if (getApps().length === 0) initializeApp()
    const result = await getAuth().getUsers(rows.map((r) => ({ uid: r.uid })))
    for (const user of result.users) emails.set(user.uid, user.email ?? null)
  } catch {
    // Leave the map empty; every row reports a null email.
  }

  return rows.map((r) => ({ ...r, email: emails.get(r.uid) ?? null }))
}

export type RemoveMemberResult = 'removed' | 'not-found' | 'last-owner'

/**
 * Revokes one membership.
 *
 * Refuses to remove the last owner, in a transaction over the member list so
 * two simultaneous removals cannot between them leave an org with nobody who
 * can manage it. An org with no owner is not recoverable by its own customer —
 * only by a platform operator — so this is the one invariant worth a
 * transaction here.
 */
export async function removeMember(slug: string, uid: string): Promise<RemoveMemberResult> {
  const members = db().collection('tenants').doc(slug).collection('members')
  const target = members.doc(uid)

  return db().runTransaction(async (tx) => {
    const doc = await tx.get(target)
    if (!doc.exists) return 'not-found' as const

    const parsed = orgMemberSchema.safeParse(doc.data())
    if (parsed.success && parsed.data.role === 'owner') {
      // Two is enough to answer "is this the last one" — reading an org's
      // whole owner list to compare a size against one is a query that gets
      // more expensive the healthier the org is.
      const owners = await tx.get(members.where('role', '==', 'owner').limit(2))
      if (owners.size <= 1) return 'last-owner' as const
    }

    tx.delete(target)
    return 'removed' as const
  })
}

/** Resolves an email to a uid via Firebase Auth, or null if no such account. */
export async function uidByEmail(email: string): Promise<string | null> {
  if (getApps().length === 0) initializeApp()
  try {
    const user = await getAuth().getUserByEmail(email)
    return user.uid
  } catch {
    return null
  }
}

/**
 * The orgs a user can open — the org picker's data.
 *
 * Members: one collection-group query on `members.uid` (needs the
 * COLLECTION_GROUP field override in firestore.indexes.json), then one
 * tenant read per org for the display name. Operators: every org, capped —
 * support tooling, not a public list.
 */
export async function listOrgs(uid: string, isOperator: boolean): Promise<OrgSummary[]> {
  const firestore = db()

  const kindOf = (data: Record<string, unknown> | undefined): TenantKind => {
    const meta = data?._meta as { kind?: unknown } | undefined
    return meta?.kind === 'personal' ? 'personal' : 'org'
  }

  const planOf = (data: Record<string, unknown> | undefined): Plan => {
    const meta = data?._meta as { plan?: unknown } | undefined
    const parsed = planSchema.safeParse(meta?.plan)
    return parsed.success ? parsed.data : 'free'
  }

  if (isOperator) {
    const snap = await firestore.collection('tenants').limit(100).get()
    return snap.docs.map((doc) => ({
      slug: doc.id,
      teamName: typeof doc.data().teamName === 'string' ? (doc.data().teamName as string) : doc.id,
      role: 'operator' as const,
      kind: kindOf(doc.data()),
      plan: planOf(doc.data()),
    }))
  }

  const memberships = await firestore.collectionGroup('members').where('uid', '==', uid).get()
  const out: OrgSummary[] = []
  for (const doc of memberships.docs) {
    const parsed = orgMemberSchema.safeParse(doc.data())
    const tenantDoc = doc.ref.parent.parent
    if (!parsed.success || !tenantDoc) continue
    const tenant = await tenantDoc.get()
    if (!tenant.exists) continue
    const teamName = tenant.data()?.teamName
    out.push({
      slug: tenantDoc.id,
      teamName: typeof teamName === 'string' ? teamName : tenantDoc.id,
      role: parsed.data.role,
      kind: kindOf(tenant.data()),
      plan: planOf(tenant.data()),
    })
  }
  return out
}

/**
 * This account's own space, if it has one. At most one exists per account:
 * it is created implicitly by the first hunt and never offered again.
 */
export async function findPersonalSpace(uid: string): Promise<string | null> {
  const orgs = await listOrgs(uid, false)
  return orgs.find((o) => o.kind === 'personal')?.slug ?? null
}
