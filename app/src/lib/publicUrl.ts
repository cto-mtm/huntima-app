/**
 * The address a fan scans or types: `https://huntima.app/louisville-bats`.
 *
 * Only the org console needs this. Everywhere else in the app navigation is
 * relative, so no other module should ever build an absolute URL.
 *
 * `window.location.origin` is correct in every browser, local dev included —
 * a QR code generated against the dev server really does open the dev server.
 * It is wrong in exactly one place: a native shell, where the origin is
 * `capacitor://localhost`. A build for the app stores must therefore set
 * VITE_PUBLIC_BASE_URL, which also covers a deploy whose public domain is not
 * the one staff happen to be signed in on.
 */
const CONFIGURED = import.meta.env.VITE_PUBLIC_BASE_URL?.replace(/\/+$/, '')

export const PUBLIC_BASE_URL =
  CONFIGURED && CONFIGURED.length > 0
    ? CONFIGURED
    : typeof window !== 'undefined'
      ? window.location.origin
      : ''

/** The org's public fan page. The slug IS the path — see docs/platform-migration.md D1. */
export function fanPageUrl(slug: string): string {
  return `${PUBLIC_BASE_URL}/${slug}`
}
