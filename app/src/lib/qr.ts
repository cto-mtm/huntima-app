/**
 * QR codes for an org's fan page.
 *
 * Loaded on demand: `qrcode-generator` is a few kilobytes, but it is only
 * ever needed by one card in the org console and must not ride along in the
 * bundle a stadium of phones downloads.
 *
 * The code is black on white and stays that way. It is the one thing in this
 * app that is deliberately NOT brand-themed — a low-contrast QR in club
 * colors is a QR that will not scan from a printed poster in daylight, and a
 * code nobody can scan is worse than an unbranded one.
 */

/** Error correction M: ~15% recoverable, the usual choice for printed codes. */
const ERROR_CORRECTION = 'M' as const

/**
 * An `<svg>` string for `data`, sized by its viewBox so CSS decides how big
 * it renders. Vector because these get printed on posters and table cards.
 *
 * The returned markup is geometry only — a rect and one path, both generated
 * from the encoded modules. No caller-supplied text is interpolated into it,
 * which is what makes it safe to mount with `v-html`.
 */
export async function qrSvg(data: string): Promise<string> {
  const { default: qrcode } = await import('qrcode-generator')
  // Type number 0 picks the smallest version that fits the data.
  const qr = qrcode(0, ERROR_CORRECTION)
  qr.addData(data)
  qr.make()
  return qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true })
}
