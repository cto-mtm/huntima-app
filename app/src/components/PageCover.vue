<script setup lang="ts">
/**
 * Full-screen navigation cover.
 *
 * A brand-colored veil that fades IN as a navigation commits and OUT once the
 * new page has painted. It sits above everything (including the ambient
 * backdrop and the fixed chrome) so the backdrop's view-transition snapshot
 * swap is never visible — which is the flicker this replaces.
 *
 * Driven by the `isNavigating` signal, which the router raises only when a
 * view transition actually runs — never for plain navigations (their swap is
 * atomic, there is nothing to mask) and never under reduced motion (a
 * full-screen veil is itself a flash). `pointer-events-none` means it never
 * eats a tap even at full opacity; the navigation is already committing
 * underneath it. The reserved view-transition-name opts the cover out of the
 * root snapshot.
 *
 * The fade timing lives in transitions.css (Recipe 14), not here — every
 * animation in the app stays in that one file.
 */
import { isNavigating, COVER_VT_NAME } from '../lib/pageTransition'
</script>

<template>
  <div
    class="page-cover pointer-events-none fixed inset-0 z-50 bg-canvas"
    :class="{ 'page-cover--active': isNavigating }"
    :style="{ viewTransitionName: COVER_VT_NAME }"
    aria-hidden="true"
  />
</template>
