import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { orgMemberSchema, type OrgRole, type OrgSummary } from 'shared'

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

export async function addMember(
  slug: string,
  uid: string,
  role: OrgRole,
  addedBy: string,
): Promise<void> {
  await memberRef(slug, uid).set({ uid, role, addedAt: Date.now(), addedBy })
}

export async function listMembers(slug: string): Promise<Array<{ uid: string; role: OrgRole }>> {
  const snap = await db().collection('tenants').doc(slug).collection('members').get()
  return snap.docs
    .map((d) => orgMemberSchema.safeParse(d.data()))
    .filter((r): r is { success: true; data: { uid: string; role: OrgRole; addedAt: number; addedBy: string } } => r.success)
    .map((r) => ({ uid: r.data.uid, role: r.data.role }))
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

  if (isOperator) {
    const snap = await firestore.collection('tenants').limit(100).get()
    return snap.docs.map((doc) => ({
      slug: doc.id,
      teamName: typeof doc.data().teamName === 'string' ? (doc.data().teamName as string) : doc.id,
      role: 'operator' as const,
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
    })
  }
  return out
}
