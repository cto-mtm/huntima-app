import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { SEED_TENANT, tenantConfigSchema, type TenantConfig } from 'shared'

/**
 * Tenant (org) storage. The slug IS the document id: `tenants/{slug}`.
 *
 * The branding contract (`tenantConfigSchema`) stays pure branding; platform
 * metadata rides in a server-written `_meta` field the schema never sees
 * (zod strips unknown keys on read, and `putTenant` preserves it on write),
 * so the branding form can never touch it.
 */
function db(): Firestore {
  if (getApps().length === 0) initializeApp()
  return getFirestore()
}

function tenantRef(slug: string) {
  return db().collection('tenants').doc(slug)
}

function memberRef(slug: string, uid: string) {
  return tenantRef(slug).collection('members').doc(uid)
}

/**
 * Returns the org's branding, or null for an unknown slug. Null becomes a
 * 404: on a platform, a mistyped slug must render "no team here", never a
 * phantom default club.
 */
export async function getTenant(slug: string): Promise<TenantConfig | null> {
  const doc = await tenantRef(slug).get()
  if (!doc.exists) return null
  const parsed = tenantConfigSchema.safeParse(doc.data())
  return parsed.success ? parsed.data : null
}

/**
 * Whole-branding replace, preserving `_meta`. Returns null when the org does
 * not exist — branding cannot bring an org into being; `createOrg` does.
 */
export async function putTenant(slug: string, config: TenantConfig): Promise<TenantConfig | null> {
  const ref = tenantRef(slug)
  const applied = await db().runTransaction(async (tx) => {
    const doc = await tx.get(ref)
    if (!doc.exists) return false
    tx.set(ref, { ...config, _meta: doc.data()?._meta ?? null })
    return true
  })
  return applied ? config : null
}

export type CreateOrgResult = 'created' | 'exists'

/**
 * Creates `tenants/{slug}` (SEED branding under the given name) plus the
 * creator's `owner` membership, atomically. Create-if-absent inside a
 * transaction: two simultaneous claims of one slug resolve to exactly one
 * winner — which matters the day self-serve signup opens this to strangers.
 */
export async function createOrg(
  slug: string,
  teamName: string,
  ownerUid: string,
): Promise<CreateOrgResult> {
  const ref = tenantRef(slug)
  return db().runTransaction(async (tx) => {
    const doc = await tx.get(ref)
    if (doc.exists) return 'exists' as const
    const now = Date.now()
    tx.set(ref, {
      ...SEED_TENANT,
      teamName,
      _meta: { createdAt: now, createdBy: ownerUid },
    })
    tx.set(memberRef(slug, ownerUid), {
      uid: ownerUid,
      role: 'owner',
      addedAt: now,
      addedBy: ownerUid,
    })
    return 'created' as const
  })
}
