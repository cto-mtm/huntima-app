/**
 * Color math for the white-label branding tool.
 *
 * The admin picks ONE brand color and one accent color. Everything else —
 * the 50→900 ramp that Tailwind utilities read — is derived here. Asking a
 * stadium marketing coordinator to hand-pick eight tints is how you end up
 * with a palette that has no through-line.
 *
 * Deliberately dependency-free and HSL-based: predictable, debuggable, and
 * good enough for a brand ramp. If you ever need perceptual uniformity,
 * swap the interior of `generateRamp` for OKLCH and nothing else changes.
 */

interface Rgb {
  r: number
  g: number
  b: number
}

interface Hsl {
  h: number
  s: number
  l: number
}

/** Tailwind stops we generate. Must match the @theme block in main.css. */
export const BRAND_STOPS = [50, 100, 200, 400, 500, 600, 700, 900] as const
export const ACCENT_STOPS = [400, 500, 600] as const

export type BrandStop = (typeof BRAND_STOPS)[number]
export type AccentStop = (typeof ACCENT_STOPS)[number]

/**
 * Target lightness per stop. The base color supplies hue and saturation
 * only — that is what keeps a ramp coherent no matter what hex is pasted in.
 */
const LIGHTNESS: Record<number, number> = {
  50: 0.96,
  100: 0.9,
  200: 0.8,
  400: 0.62,
  500: 0.52,
  600: 0.42,
  700: 0.33,
  900: 0.18,
}

export function isValidHex(value: string): boolean {
  return /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim())
}

export function normalizeHex(value: string): string {
  let hex = value.trim().replace(/^#/, '')
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('')
  }
  return `#${hex.toLowerCase()}`
}

function hexToRgb(hex: string): Rgb {
  const h = normalizeHex(hex).slice(1)
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

function rgbToHex({ r, g, b }: Rgb): string {
  const to2 = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0')
  return `#${to2(r)}${to2(g)}${to2(b)}`
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  const d = max - min

  if (d === 0) return { h: 0, s: 0, l }

  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
  else if (max === gn) h = ((bn - rn) / d + 2) / 6
  else h = ((rn - gn) / d + 4) / 6

  return { h, s, l }
}

function hslToRgb({ h, s, l }: Hsl): Rgb {
  if (s === 0) {
    const v = l * 255
    return { r: v, g: v, b: v }
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q

  const channel = (t: number): number => {
    let tn = t
    if (tn < 0) tn += 1
    if (tn > 1) tn -= 1
    if (tn < 1 / 6) return p + (q - p) * 6 * tn
    if (tn < 1 / 2) return q
    if (tn < 2 / 3) return p + (q - p) * (2 / 3 - tn) * 6
    return p
  }

  return {
    r: channel(h + 1 / 3) * 255,
    g: channel(h) * 255,
    b: channel(h - 1 / 3) * 255,
  }
}

/**
 * Rotate a color's hue, keeping saturation and lightness. Used to DERIVE the
 * far end of the CTA gradient from the tenant's single accent pick — orange
 * becomes orange→magenta, a club red becomes red→violet — so the candy
 * gradient re-skins per tenant without asking anyone to pick a second color.
 * Same philosophy as the ramp: derived, not hand-picked.
 */
export function rotateHue(baseHex: string, degrees: number): string {
  const hsl = rgbToHsl(hexToRgb(baseHex))
  const h = (((hsl.h + degrees / 360) % 1) + 1) % 1
  return rgbToHex(hslToRgb({ ...hsl, h }))
}

/** The accent→accent-alt hue shift. -60° turns electric orange into magenta. */
export const ACCENT_ALT_HUE_SHIFT = -60

/**
 * Derive a full ramp from one base hex.
 *
 * Saturation is eased down at the extremes: a fully saturated 50 reads as a
 * tinted grey-out rather than a neutral surface, and a fully saturated 900
 * turns muddy.
 */
export function generateRamp(baseHex: string, stops: readonly number[] = BRAND_STOPS): Record<number, string> {
  const base = rgbToHsl(hexToRgb(baseHex))
  const ramp: Record<number, string> = {}

  for (const stop of stops) {
    const l = LIGHTNESS[stop] ?? base.l
    // Pull saturation in as we approach white or black.
    const distanceFromMid = Math.abs(l - 0.5) * 2
    const s = base.s * (1 - distanceFromMid * 0.35)
    ramp[stop] = rgbToHex(hslToRgb({ h: base.h, s, l }))
  }

  return ramp
}

// ── Contrast ──────────────────────────────────────────────────────────
// The app is used outdoors, in daylight, on a phone held at arm's length.
// A brand color that fails contrast is not a style opinion, it is a
// mission that cannot be read.

function channelLuminance(c: number): number {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex)
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b)
}

/** WCAG 2.1 contrast ratio, 1–21. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const lighter = Math.max(la, lb)
  const darker = Math.min(la, lb)
  return (lighter + 0.05) / (darker + 0.05)
}

export type ContrastGrade = 'aaa' | 'aa' | 'aa-large' | 'fail'

export function gradeContrast(ratio: number): ContrastGrade {
  if (ratio >= 7) return 'aaa'
  if (ratio >= 4.5) return 'aa'
  if (ratio >= 3) return 'aa-large'
  return 'fail'
}
