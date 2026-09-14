import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import {
  RESERVED_SLUGS,
  SEED_TENANT,
  isValidTenantSlug,
  tenantConfigSchema,
  type TenantConfig,
  type TenantKind,
} from 'shared'

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
 * Does this slug already belong to someone? Backs the claim-your-URL probe.
 *
 * A `get` rather than a listing: the answer is one bit about one name the
 * caller already typed, which is not the same as being able to enumerate
 * the platform's orgs.
 */
export async function tenantExists(slug: string): Promise<boolean> {
  const doc = await tenantRef(slug).get()
  return doc.exists
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

/** Server-written tenant metadata. The branding contract never sees it. */
interface TenantMeta {
  createdAt: number
  createdBy: string
  kind: TenantKind
}

/** Reads the server-written kind. Absent means a tenant from before the
 *  split, and every one of those was an org. */
export async function getTenantKind(slug: string): Promise<TenantKind | null> {
  const doc = await tenantRef(slug).get()
  if (!doc.exists) return null
  const meta = doc.data()?._meta as Partial<TenantMeta> | undefined
  return meta?.kind === 'personal' ? 'personal' : 'org'
}

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
  kind: TenantKind = 'org',
): Promise<CreateOrgResult> {
  const ref = tenantRef(slug)
  return db().runTransaction(async (tx) => {
    const doc = await tx.get(ref)
    if (doc.exists) return 'exists' as const
    const now = Date.now()
    tx.set(ref, {
      ...SEED_TENANT,
      teamName,
      _meta: { createdAt: now, createdBy: ownerUid, kind },
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

/**
 * Turns a display name into a candidate address: "Sarah Okonkwo" -> "sarah-okonkwo".
 *
 * Never derived from an email address. The result becomes a public URL on
 * every QR code this account prints, and an email local part is both an
 * identifier people did not choose to publish and a reliable collision
 * factory (every `jsmith` on the platform wants the same one).
 */
export function handleFromName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

/**
 * Claims a personal space for `uid`, trying `preferred` and then numbered
 * variants of it until one is free.
 *
 * Create-if-absent is already transactional in `createOrg`, so a losing racer
 * simply moves to the next candidate rather than overwriting anybody. The
 * attempt count is small on purpose: past a handful of collisions the base
 * name is too popular to keep guessing at, and the caller should ask the
 * person for one instead of minting `sarah-9`.
 */
export async function claimPersonalSpace(
  uid: string,
  preferred: string,
  displayName: string,
): Promise<string | null> {
  const base = isValidTenantSlug(preferred) ? preferred : handleFromName(preferred)
  const seeds = [base]
  for (let n = 2; n <= 6; n += 1) seeds.push(`${base}-${n}`)

  for (const candidate of seeds) {
    if (!isValidTenantSlug(candidate) || RESERVED_SLUGS.has(candidate)) continue
    const result = await createOrg(candidate, displayName, uid, 'personal')
    if (result === 'created') return candidate
  }
  return null
}
