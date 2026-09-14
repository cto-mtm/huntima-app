import { z } from 'zod'

/**
 * Billing plans — the CAPABILITY axis of a tenant, orthogonal to `_meta.kind`
 * (which is vocabulary + setup depth, see `tenantKindSchema`).
 *
 * `kind` answers "what is this tenant" (a person's space vs an organization);
 * `plan` answers "what has it paid for". A wedding host (kind: personal) can be
 * on the `event` plan; a club (kind: org) can sit on `free`. The two never
 * collapse into one flag, so they are two fields.
 *
 * Server-written, defaulting to `free`, and — like `kind` — never editable
 * through the branding form. There is NO billing code yet (no Stripe, no
 * checkout): a plan is set by a platform operator today, and a payment webhook
 * will write the same field later. This module is the single limits table both
 * the API (which enforces) and the app (which renders upgrade prompts /
 * disabled controls) import, so the two can never disagree about what a plan
 * grants. See BUSINESS_MODEL.md.
 */
export const PLANS = ['free', 'event', 'business', 'venue'] as const
export const planSchema = z.enum(PLANS)
export type Plan = z.infer<typeof planSchema>

/** Visual branding depth. `none` = platform-branded (wears Huntima chrome —
 *  NOT a brand); `light` = accent only; `full` = colors, logo and font. */
export type BrandingLevel = 'none' | 'light' | 'full'

export interface PlanLimits {
  /** Unique players admitted per hunt — a SOFT cap. Not enforced yet; the
   *  per-tenant verify-capture budget is where it will plug in. */
  playersPerHunt: number
  branding: BrandingLevel
  /** Photo gallery retention (a paid data-controller obligation, not an upsell). */
  gallery: boolean
  /** Player roster export. */
  roster: boolean
}

/**
 * The one limits table. `venue` uses a large finite player cap rather than
 * Infinity so the value stays JSON-safe if it is ever serialised.
 */
export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: { playersPerHunt: 10, branding: 'none', gallery: false, roster: false },
  event: { playersPerHunt: 100, branding: 'light', gallery: true, roster: false },
  business: { playersPerHunt: 250, branding: 'full', gallery: true, roster: true },
  venue: { playersPerHunt: 100_000, branding: 'full', gallery: true, roster: true },
}

/** Can this plan customise its visual brand (colors, logo, font)? The gate the
 *  branding write enforces and the branding UI reads. */
export function canBrand(plan: Plan): boolean {
  return PLAN_LIMITS[plan].branding !== 'none'
}

/** The branding depth a plan is entitled to, for UI that wants to distinguish
 *  `light` (accent only) from `full`. */
export function brandingLevel(plan: Plan): BrandingLevel {
  return PLAN_LIMITS[plan].branding
}
