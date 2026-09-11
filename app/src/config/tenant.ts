/**
 * Tenant (team) configuration — one of the two white-label seams.
 *
 * The other is the `--brand-*` custom properties in assets/css/main.css.
 * Between them they are the entire re-skin. If you find yourself hardcoding
 * a team name, venue, or color anywhere else in the app, that's a bug.
 *
 * Note what is NOT here: user-facing sentences. Those are i18n keys. What
 * lives here is brand DATA — proper nouns that are passed through verbatim
 * in every language, exactly like a fan's nickname.
 */
export interface TenantConfig {
  /** Proper noun. Not translated — interpolated into i18n messages. */
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
   * Stadium geofence. SEAM: currently unused — CapturePage.vue simulates
   * validation. When @capacitor/geolocation lands, check the device position
   * against this, and re-check it server-side (a client can lie).
   */
  geofence: { lat: number; lng: number; radiusMeters: number }
  /** Avatar options offered at onboarding. Ids are i18n-free by design. */
  avatars: readonly string[]
}

export const tenant: TenantConfig = {
  teamName: 'REPLACE_ME Team',
  prizeLocation: 'the Main Team Store',
  badgeTarget: 5,
  timezone: 'America/New_York',
  geofence: { lat: 40.7128, lng: -74.006, radiusMeters: 400 },
  avatars: ['⚾', '🧢', '🥎', '🦅', '🐻', '🚀'],
}
