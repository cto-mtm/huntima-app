<script setup lang="ts">
/**
 * Full-screen navigation cover — a camera shutter.
 *
 * Colored wedges twist shut over the whole viewport while a navigation
 * commits, then twist open on the settled new page. It is the app's own mark
 * in motion: Huntima's logo is a lens aperture, and moving between screens in
 * a photo-hunt reads as taking a shot. It also still does the unglamorous job
 * this component was built for — hiding the page swap.
 *
 * Each blade is a real WEDGE in its own color, not an overlapping half-plane.
 * The first version stacked identical dark half-planes, so all but one were
 * permanently hidden behind the last and the whole thing read as a slab
 * sliding in. The seams between differently-colored wedges are what make the
 * mechanism legible.
 *
 * ── Vue owns the mechanics ───────────────────────────────────
 * This used to hand-roll a `transitionend` listener and filter the events
 * itself. `<Transition>` already watches for that and reports completion
 * through `@after-enter`, so it does the work now.
 *
 * `:duration` is required rather than optional here: Vue detects the end of a
 * transition on the ROOT transition element, and the root is a bare container
 * — the blades inside it are what animate. This is exactly the nested case
 * the duration prop exists for.
 *
 * `v-if` rather than a toggled class, so the whole overlay leaves the DOM
 * between navigations instead of sitting invisible at z-50 forever.
 *
 * The router raises this ONLY on the shutter path — never alongside a view
 * transition, which would freeze the blades in a snapshot, and never under
 * reduced motion, where a full-screen shutter is precisely the flash that
 * setting asks us not to show. Recipe 14 carries a CSS backstop for an OS
 * setting flipped mid-session.
 */
import {
  isNavigating,
  coverClosed,
  COVER_VT_NAME,
  CLOSE_MS,
  OPEN_MS,
} from '../lib/pageTransition'

/**
 * One color per blade, walked around the tenant's own ramps rather than a
 * fixed rainbow — the shutter is the club's prism. Ordered so adjacent blades
 * contrast: the seams between them are what make the wedges read as blades
 * instead of one dark slab.
 *
 * This array is the ONLY place the blade count is declared. Its length goes
 * out as `--blades`, and Recipe 14 derives the wedge angle, the box height
 * and every rotation from it — so adding or removing a color re-cuts the
 * geometry to match instead of silently breaking it.
 */
const BLADES = [
  'var(--color-accent-400)',
  'var(--color-brand-500)',
  'var(--color-accent-alt-500)',
  'var(--color-brand-700)',
  'var(--color-accent-500)',
  'var(--color-accent-alt-600)',
] as const

/**
 * Timings come from lib/pageTransition.ts and go out to CSS as custom
 * properties, so the durations Vue waits on and the durations the blades
 * actually animate for cannot drift apart.
 */
const coverStyle = {
  viewTransitionName: COVER_VT_NAME,
  '--blades': BLADES.length,
  '--close-ms': `${CLOSE_MS}ms`,
  '--open-ms': `${OPEN_MS}ms`,
}
</script>

<template>
  <Transition
    name="shutter"
    :duration="{ enter: CLOSE_MS, leave: OPEN_MS }"
    @after-enter="coverClosed"
    @enter-cancelled="coverClosed"
  >
    <div
      v-if="isNavigating"
      class="page-cover pointer-events-none fixed inset-0 z-50 overflow-hidden"
      :style="coverStyle"
      aria-hidden="true"
    >
      <span
        v-for="(blade, i) in BLADES"
        :key="i"
        class="shutter-blade"
        :style="{ '--i': i, '--blade': blade }"
      />
    </div>
  </Transition>
</template>
