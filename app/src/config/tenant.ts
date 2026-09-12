import { SEED_TENANT, type TenantConfig } from 'shared'

/**
 * Tenant defaults and venue constants.
 *
 * The tenant CONFIG itself now lives in `shared` and is served by the API, so
 * every device in the building shows the same brand. This file holds only the
 * fallback and the things that are not yet part of that contract.
 */
// Types are NOT re-exported here: consumers import them from 'shared'
// directly. Routing a shared type through a second module is how a second,
// subtly different definition gets written later.

/** What a brand-new deployment looks like before staff touch anything. */
export const DEFAULT_TENANT: TenantConfig = SEED_TENANT

// The stadium geofence used to be a hardcoded constant here. It is now part of
// the tenant contract (`venue` in tenantConfigSchema), editable per club on the
// Branding tab, and checked client-side by `useGeofence`. Server-side re-check
// remains a hardening seam — a client can still lie about where it is.
