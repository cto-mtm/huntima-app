import { ref } from 'vue'

/**
 * The navigation shutter: its signal, and the whole of its timing.
 *
 * ── One navigation, ONE animation system ─────────────────────
 * This app has two ways of animating a route change and they must never run
 * at the same time:
 *
 *   The SHUTTER (this module + PageCover.vue) — colored blades close over the
 *   viewport, the page swaps behind them, they open. Used for moves BETWEEN
 *   sections, where nothing on the old page continues onto the new one.
 *
 *   The VIEW TRANSITION (router/index.ts + Recipes 1-2) — the browser
 *   snapshots both pages and morphs matched `view-transition-name` pairs.
 *   Used for moves WITHIN the mission flow, where a mission's thumbnail
 *   really does become the header of the page you are opening.
 *
 * They cannot be combined. A view transition replaces every element it
 * captures with a STATIC SNAPSHOT for the duration, so blades animating
 * underneath one animate where nobody is painting, then jump to wherever they
 * got to when it ends. A full-screen cover also makes a morph pointless: once
 * it is shut there is nothing to see.
 *
 * ── What Vue does, and what it does not ──────────────────────
 * `<Transition>` already watches `transitionend` and reports completion via
 * `@after-enter`, so PageCover uses that rather than a hand-rolled listener.
 *
 * What Vue Router deliberately does NOT offer is a way to await a transition
 * before a navigation commits (its transitions guide says so outright). That
 * is the one piece this module still has to provide, and it is the reason
 * `closeCover` returns a promise at all: the route must not swap until the
 * screen is actually covered.
 *
 * Every duration lives here. PageCover hands them to CSS as custom properties
 * and to `<Transition :duration>`, so there is one owner and no number to
 * keep in sync across files.
 */
export const isNavigating = ref(false)

/** Blades parked → fully shut. */
export const CLOSE_MS = 300

/** Fully shut → parked again. */
export const OPEN_MS = 320

/**
 * How long the blades stay shut once the new page has painted.
 *
 * Without this the shutter read as a flash. The new page paints on the very
 * next frame of a warm route, so the screen was actually covered for 17ms:
 * blades swept in, touched, swept out. A cover has to be *seen* to be closed
 * for the swap behind it to register as a swap. Not dead time — the new page
 * is rendering throughout.
 */
const HOLD_MS = 180

/**
 * Upper bound on waiting for the close, in case `@after-enter` never arrives
 * — an interrupted transition, a backgrounded tab. Deliberately loose: it
 * should never be what resolves the promise in normal use, which is why it
 * does not need to track CLOSE_MS exactly.
 */
const CLOSE_TIMEOUT_MS = CLOSE_MS + 400

/** The view-transition-name reserved for the cover so it opts out of `root`. */
export const COVER_VT_NAME = 'page-cover'

/** Resolver for the in-flight close, if any. */
let settleClose: (() => void) | null = null

/**
 * The current navigation's close, memoized.
 *
 * `closeCover` is now called twice per navigation: first from the router's
 * `beforeEach` — so the blades start closing the INSTANT a tap begins, hiding
 * the guard + lazy-chunk freeze behind a shutter that is already moving — and
 * again from `beforeResolve`, the gate that must not let the route commit
 * until the screen is actually covered. Both must share ONE close: a naive
 * second call would build a fresh promise waiting on an `@after-enter` that
 * already fired, stalling the commit for the whole timeout. `openCover` clears
 * this, so the next navigation starts a fresh close.
 */
let closePromise: Promise<void> | null = null

function settle(): void {
  const resolve = settleClose
  settleClose = null
  resolve?.()
}

/**
 * Shut the blades, resolving once they have ACTUALLY landed. Idempotent within
 * a single navigation (see `closePromise`): the first caller starts the close,
 * every later caller shares its landing, so the router can both kick it off
 * early and await it later without double-triggering.
 */
export function closeCover(): Promise<void> {
  if (closePromise) return closePromise
  isNavigating.value = true
  closePromise = new Promise((resolve) => {
    settleClose = resolve
    setTimeout(settle, CLOSE_TIMEOUT_MS)
  })
  return closePromise
}

/** Bound to `<Transition @after-enter>` in PageCover: the blades have landed. */
export function coverClosed(): void {
  settle()
}

/**
 * Open the blades immediately, skipping the hold. The safety valve for a
 * navigation that errors mid-flight — a stuck cover is a blank app.
 */
export function openCover(): void {
  settle()
  closePromise = null
  isNavigating.value = false
}

/**
 * The normal end of a navigation: hold the shut blades for a beat, then open
 * on the settled new page. The router calls this once Vue has painted.
 */
export function revealPage(): void {
  setTimeout(openCover, HOLD_MS)
}
