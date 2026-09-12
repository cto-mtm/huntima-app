import type { FontChoice } from 'shared'

/**
 * The typeface catalogue.
 *
 * Curated rather than pulled live from the Google Fonts API, for three
 * reasons: the API needs a key, the full list is ~1,700 families which is a
 * worse experience than a short good one, and every entry here has been
 * paired with a real fallback stack and a weight set the app actually uses.
 *
 * Weights are pinned to 400/600/800 — the three the UI renders. Requesting
 * the full range would multiply the download for glyphs nothing displays.
 */
interface FontSpec {
  /** Shown in the admin dropdown. Not translated: a typeface name is a name. */
  label: string
  /** Google Fonts family name. Absent for the system stack, which loads nothing. */
  google?: string
  /** The CSS value written to --font-brand. */
  stack: string
}

const SYSTEM_STACK = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

export const FONTS: Record<FontChoice, FontSpec> = {
  system: { label: 'System default', stack: SYSTEM_STACK },
  inter: { label: 'Inter', google: 'Inter', stack: `'Inter', ${SYSTEM_STACK}` },
  roboto: { label: 'Roboto', google: 'Roboto', stack: `'Roboto', ${SYSTEM_STACK}` },
  'open-sans': { label: 'Open Sans', google: 'Open Sans', stack: `'Open Sans', ${SYSTEM_STACK}` },
  montserrat: { label: 'Montserrat', google: 'Montserrat', stack: `'Montserrat', ${SYSTEM_STACK}` },
  oswald: { label: 'Oswald', google: 'Oswald', stack: `'Oswald', ${SYSTEM_STACK}` },
  rubik: { label: 'Rubik', google: 'Rubik', stack: `'Rubik', ${SYSTEM_STACK}` },
  barlow: { label: 'Barlow', google: 'Barlow', stack: `'Barlow', ${SYSTEM_STACK}` },
}

const LINK_ID = 'tenant-font'
const WEIGHTS = '400;600;800'

/**
 * Applies a typeface at runtime.
 *
 * `display=swap` so text paints immediately in the fallback and reflows when
 * the webfont lands. The alternative is invisible text on a slow connection,
 * which in a concourse is most of them.
 */
export function applyFont(choice: FontChoice): void {
  const spec = FONTS[choice] ?? FONTS.system

  document.documentElement.style.setProperty('--font-brand', spec.stack)

  const existing = document.getElementById(LINK_ID)

  if (!spec.google) {
    existing?.remove()
    return
  }

  const family = spec.google.replace(/ /g, '+')
  const href = `https://fonts.googleapis.com/css2?family=${family}:wght@${WEIGHTS}&display=swap`

  if (existing instanceof HTMLLinkElement) {
    if (existing.href !== href) existing.href = href
    return
  }

  const link = document.createElement('link')
  link.id = LINK_ID
  link.rel = 'stylesheet'
  link.href = href
  document.head.appendChild(link)
}
