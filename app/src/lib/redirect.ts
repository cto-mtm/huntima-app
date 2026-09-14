/**
 * Same-origin redirect targets.
 *
 * Sign-in pages and the router guard all carry a `?to=` so a deep link
 * survives authentication. That value is attacker-writable, so it is checked
 * before anyone navigates to it — and checked in ONE place, because three
 * copies of a security check are three chances for a future tightening to
 * land in two of them.
 *
 * Accepts only a path on this origin. A protocol-relative `//evil.example`
 * is the case worth naming: it starts with a slash, so a naive "is it
 * relative" test passes it, and the browser then treats it as an absolute
 * URL to another host. A backslash is rejected for the same reason, since
 * some parsers normalise it to a slash.
 */
export function safeInternalPath(value: unknown): string | null {
  if (typeof value !== 'string') return null
  if (!value.startsWith('/')) return null
  if (value.startsWith('//') || value.startsWith('/\\')) return null
  return value
}
