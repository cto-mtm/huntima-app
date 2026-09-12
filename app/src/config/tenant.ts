import { SEED_TENANT, type TenantConfig } from 'shared'

/**
 * Tenant defaults and venue constants.
 *
 * The tenant CONFIG itself now lives in `shared` and is served by the API, so
 * every device in the building shows the same brand. This file holds only the
 * fallback and the things that are not yet part of that contract.
 */
export type { TenantConfig, TenantAvatar } from 'shared'

/** What a brand-new deployment looks like before staff touch anything. */
export const DEFAULT_TENANT: TenantConfig = SEED_TENANT

/**
 * Stadium geofence. SEAM: currently unused — capture verification is visual
 * only. When @capacitor/geolocation lands, check the device position against
 * this AND re-check it server-side, because a client can lie about where it is.
 *
 * Not part of the tenant contract yet: it needs a map picker in the admin
 * tool to be usable, and a hardcoded constant is honest about that.
 */
export const VENUE_GEOFENCE = { lat: 38.2564, lng: -85.7444, radiusMeters: 400 }
