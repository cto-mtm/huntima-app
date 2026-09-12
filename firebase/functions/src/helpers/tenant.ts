import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { SEED_TENANT, tenantConfigSchema, type TenantConfig } from 'shared'

/**
 * Tenant branding storage.
 *
 * Single-tenant for now: one deployment serves one club, so there is exactly
 * one document. When the platform hosts several, this gains a tenant id and
 * the rules gain a membership check instead of a bare admin claim.
 */
const DOC = 'tenants/default'

function db() {
  if (getApps().length === 0) initializeApp()
  return getFirestore()
}

/**
 * Falls back to the built-in defaults rather than 404ing. A fresh install has
 * no tenant document, and that is a normal state — the app must still render
 * a coherent brand, not an error.
 */
export async function getTenant(): Promise<TenantConfig> {
  try {
    const doc = await db().doc(DOC).get()
    if (doc.exists) {
      const parsed = tenantConfigSchema.safeParse(doc.data())
      if (parsed.success) return parsed.data
    }
  } catch {
    // Firestore unreachable. Defaults beat a 500 on the fan's first paint.
  }
  return SEED_TENANT
}

export async function putTenant(config: TenantConfig): Promise<TenantConfig> {
  await db().doc(DOC).set(config)
  return config
}
