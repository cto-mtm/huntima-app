import { ref } from 'vue'

/**
 * A tiny module-level signal for the full-screen navigation cover.
 *
 * WHY A COVER AT ALL
 * The ambient backdrop (AppShell) is an always-on `position: fixed` decorative
 * layer that drifts continuously. It carries its own `view-transition-name` so
 * the page-lift doesn't drag it — but that also means the View Transitions API
 * snapshots it, freezes its drift for the duration, and cross-fades two
 * near-identical frames, which reads as a flicker no amount of per-group CSS
 * fully removes across engines.
 *
 * Rather than keep fighting the snapshot system for a purely decorative layer,
 * we lay a brand-colored cover OVER the whole viewport for the brief moment a
 * navigation is committing. The cover hides the backdrop's snapshot swap
 * entirely, then fades away to reveal the settled new page. It is driven by
 * the router lifecycle (see router/index.ts), NOT by view-transition pseudo-
 * elements — and the router raises it ONLY when a view transition actually
 * runs: a plain navigation swaps the DOM in one atomic frame (nothing to
 * mask), and reduced motion must never be shown a full-screen flash.
 *
 * `COVER_VT_NAME` (a view-transition-name) keeps the cover element OUT of the
 * root snapshot, so the content lift underneath is still captured cleanly.
 */
export const isNavigating = ref(false)

/** The view-transition-name reserved for the cover so it opts out of `root`. */
export const COVER_VT_NAME = 'page-cover'
