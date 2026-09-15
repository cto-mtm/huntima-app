/**
 * Hands one freshly-shot photo from the mission page to the capture page.
 *
 * ── Why this exists ───────────────────────────────────────────
 * The camera has to open inside the tap that asks for it. `input.click()` only
 * opens the OS camera while the browser still considers itself inside a user
 * gesture, and a gesture does not survive a route change — so "navigate, then
 * open the camera on mount" is silently blocked on iOS and unreliable
 * everywhere else.
 *
 * That constraint is what produced the old flow: tap "Open camera", land on a
 * page showing a *drawn* viewfinder, tap a second button, and only then get a
 * real camera. The middle screen existed to host the tap, not to do anything.
 *
 * So the tap stays on the mission page, where it is already a gesture, and the
 * resulting File is left here for the capture page to pick up. A File cannot
 * ride in a URL and has no business in persistent state — it is a few
 * megabytes of a photo of a child's afternoon — so this is a module-scoped
 * handoff and nothing more.
 *
 * Read exactly once: `take` clears it. A refresh or a direct link to the
 * capture route therefore finds nothing pending, which is correct — that fan
 * has not taken a photo yet, and the capture page falls back to asking for
 * one itself.
 */
let pending: File | null = null

export function setPendingCapture(file: File): void {
  pending = file
}

/** Consumes the pending photo. Returns null if there isn't one. */
export function takePendingCapture(): File | null {
  const file = pending
  pending = null
  return file
}
