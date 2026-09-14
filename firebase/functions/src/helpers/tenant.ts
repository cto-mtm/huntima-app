import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import {
  RESERVED_SLUGS,
  SEED_TENANT,
  canBrand,
  isValidTenantSlug,
  planSchema,
  tenantConfigSchema,
  type Plan,
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
 * Enforces a plan's branding entitlement on a branding write.
 *
 * A plan that cannot brand (free) keeps the platform's neutral skin no matter
 * what the form submits, so a free tenant is GENUINELY platform-branded rather
 * than merely told so — the gate is the server, not the UI. Only the visual
 * identity is coerced; functional fields (name, prize location, badge target,
 * timezone, geofence) are content every tenant sets and are never touched.
 */
export function brandingForPlan(config: TenantConfig, plan: Plan): TenantConfig {
  if (canBrand(plan)) return config
  return {
    ...config,
    brandBase: SEED_TENANT.brandBase,
    accentBase: SEED_TENANT.accentBase,
    fontFamily: SEED_TENANT.fontFamily,
    logoUrl: SEED_TENANT.logoUrl,
    avatars: SEED_TENANT.avatars,
  }
}

/**
 * Sets a tenant's billing plan. Operator-only at the call site — the stand-in
 * for a future payment webhook, which will write this same `_meta.plan` field.
 * A dotted field path so the rest of `_meta` (kind, provenance) is untouched.
 * Returns false for an unknown slug.
 */
export async function setTenantPlan(slug: string, plan: Plan): Promise<boolean> {
  const ref = tenantRef(slug)
  const doc = await ref.get()
  if (!doc.exists) return false
  await ref.update({ '_meta.plan': plan })
  return true
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
  /** Billing plan — the capability axis. Absent = a tenant written before the
   *  field existed, which is free. Server-written; never touched by branding. */
  plan: Plan
}

/** The tenant's kind and plan, or null for an unknown slug. Absent metadata
 *  resolves to the safe defaults (`org` predates the kind split; `free`
 *  predates plans). This is the read the branding write consults to enforce
 *  the entitlement, so it never trusts a client-supplied value. */
export async function getTenantMeta(
  slug: string,
): Promise<{ kind: TenantKind; plan: Plan } | null> {
  const doc = await tenantRef(slug).get()
  if (!doc.exists) return null
  const meta = doc.data()?._meta as Partial<TenantMeta> | undefined
  const kind: TenantKind = meta?.kind === 'personal' ? 'personal' : 'org'
  const plan = planSchema.safeParse(meta?.plan)
  return { kind, plan: plan.success ? plan.data : 'free' }
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
      // Every tenant starts free — including a deliberately-created org. A
      // paid plan is a later, operator-/webhook-written flip, never granted at
      // creation. See BUSINESS_MODEL.md (conversion is at event publish time).
      _meta: { createdAt: now, createdBy: ownerUid, kind, plan: 'free' as Plan },
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
 * Creates this account's personal space, or returns the one it already has —
 * atomically, so a burst of "first hunt" requests can never mint two.
 *
 * The caller checks `findPersonalSpace` first (a strongly-consistent
 * collection-group query) which catches an EXISTING space, including any from
 * before this lock existed. But two near-simultaneous first hunts both see
 * "none" — nothing is stale, the space genuinely does not exist yet — and each
 * would claim a slug, leaving the account with two personal tenants.
 *
 * The fix is a per-account lock doc, `personal_spaces/{uid}`, read at the top
 * of the transaction. The tenant, its owner membership, and the lock are all
 * written in the SAME transaction, so there is no window between "chose the
 * slug" and "claimed it". Firestore's optimistic concurrency does the rest:
 * both racers read the same lock doc, the first to commit writes it, and the
 * loser's transaction retries, sees the lock, and returns the winner's slug
 * rather than creating a second space.
 */
export async function ensurePersonalSpace(
  uid: string,
  preferred: string,
  displayName: string,
): Promise<string | null> {
  const firestore = db()
  const lockRef = firestore.collection('personal_spaces').doc(uid)

  const base = isValidTenantSlug(preferred) ? preferred : handleFromName(preferred)
  const seeds = [base]
  for (let n = 2; n <= 6; n += 1) seeds.push(`${base}-${n}`)

  return firestore.runTransaction(async (tx) => {
    // The serialization point: every concurrent first-hunt for this account
    // reads the same lock doc, so the loser retries once the winner commits.
    const lock = await tx.get(lockRef)
    const claimed = lock.exists ? lock.data()?.slug : null
    if (typeof claimed === 'string' && claimed) return claimed

    // No space yet: take the first free candidate. Every tenant read happens
    // before the writes below — Firestore requires all reads first.
    for (const candidate of seeds) {
      if (!isValidTenantSlug(candidate) || RESERVED_SLUGS.has(candidate)) continue
      const ref = tenantRef(candidate)
      const doc = await tx.get(ref)
      if (doc.exists) continue

      const now = Date.now()
      tx.set(ref, {
        ...SEED_TENANT,
        teamName: displayName,
        _meta: {
          createdAt: now,
          createdBy: uid,
          kind: 'personal' as TenantKind,
          plan: 'free' as Plan,
        },
      })
      tx.set(memberRef(candidate, uid), { uid, role: 'owner', addedAt: now, addedBy: uid })
      tx.set(lockRef, { slug: candidate, uid, createdAt: now })
      return candidate
    }
    return null
  })
}
