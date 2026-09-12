/**
 * Tenant (team) DEFAULTS — the values a brand-new deployment starts from.
 *
 * These are no longer the live values. `stores/tenant.ts` seeds itself from
 * this file and is what the app actually reads, so the admin branding screen
 * can change identity at runtime. Edit this file to change what a fresh
 * install looks like; use /admin/branding to change what you are looking at.
 *
 * Note what is NOT here: user-facing sentences. Those are i18n keys. What
 * lives here is brand DATA — proper nouns passed through verbatim in every
 * language, exactly like a fan's nickname.
 */
export interface TenantConfig {
  /**
   * The club's name as it should appear, e.g. "Riverdogs" — set in the
   * admin dashboard. Do NOT append "Team": every surface that shows it
   * already reads as a team name, and "Riverdogs Team" is how a template
   * announces itself as a template.
   *
   * Proper noun. Not translated — interpolated into i18n messages.
   */
  teamName: string
  /** Where a winner physically goes to claim. Proper noun, not translated. */
  prizeLocation: string
  /**
   * Default badge target, used only until GET /missions returns. The
   * campaign is authoritative once loaded — see stores/progress.ts.
   */
  badgeTarget: number
  /** Venue timezone, used for rendering timestamps. */
  timezone: string
  /**
   * Base brand color. The full 50→900 ramp Tailwind reads is derived from
   * this one hex by lib/color.ts — see docs/branding.md.
   */
  brandBase: string
  /** Base accent color, used for rewards, badges and the win state. */
  accentBase: string
  /**
   * Stadium geofence. SEAM: currently unused — CapturePage.vue simulates
   * validation. When @capacitor/geolocation lands, check the device position
   * against this, and re-check it server-side (a client can lie).
   */
  geofence: { lat: number; lng: number; radiusMeters: number }
  /**
   * Team logo, uploaded in the admin dashboard. Null on a fresh install, in
   * which case the app falls back to a monogram of the team name — never a
   * placeholder graphic, which looks broken rather than unset.
   */
  logoUrl: string | null
  /**
   * Avatar options offered at onboarding, uploaded by staff.
   *
   * Empty on a fresh install, and that is a supported state: the onboarding
   * flow skips the picker entirely rather than showing an empty grid, and the
   * fan is identified by their nickname alone.
   */
  avatars: TenantAvatar[]
}

export interface TenantAvatar {
  /** Stable across renames; what progress stores, so a re-upload can't silently reassign someone's face. */
  id: string
  url: string
  /** Accessible name. Derived from the file name at upload time. */
  label: string
}

export const DEFAULT_TENANT: TenantConfig = {
  teamName: 'REPLACE_ME',
  prizeLocation: 'the Main Team Store',
  badgeTarget: 5,
  timezone: 'America/New_York',
  brandBase: '#2f5885',
  accentBase: '#d09a2c',
  geofence: { lat: 40.7128, lng: -74.006, radiusMeters: 400 },
  logoUrl: null,
  avatars: [],
}
