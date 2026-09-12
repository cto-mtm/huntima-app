<script setup lang="ts">
/**
 * The always-on backdrop behind fan pages: a handful of brand-colored shapes
 * drifting very slowly (Recipe 12 in transitions.css). This is a sanctioned
 * ambient layer — see docs/animations.md §4 — kept livable by three limits:
 * low opacity, glacial durations (20s+), and transform-only movement.
 *
 * Purely decorative: aria-hidden, pointer-events-none, and under reduced
 * motion the shapes simply hold still (static decor is fine; motion is not).
 *
 * Every color is a brand/accent token, so the backdrop re-skins with the
 * tenant like everything else. Rendered only inside AppShell, so admin and
 * pre-session pages never get it.
 */
import AppIcon from './AppIcon.vue'
</script>

<template>
  <div class="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
    <!-- Soft blobs. Negative delays desync the loops so nothing pulses in
         sync; --drift-rot bakes each shape's resting tilt into the keyframes
         (a static rotate class would be overridden by the animation). -->
    <div
      class="ambient-drift absolute -left-10 top-24 size-40 rounded-full bg-brand-200/40"
      style="--drift-duration: 26s"
    />
    <div
      class="ambient-drift absolute -right-16 top-1/3 size-56 rounded-[3.5rem] bg-accent-400/15"
      style="--drift-duration: 34s; --drift-rot: 14deg; animation-delay: -9s"
    />
    <div
      class="ambient-drift absolute bottom-44 left-1/4 size-24 rounded-full bg-brand-400/15"
      style="--drift-duration: 22s; animation-delay: -15s"
    />
    <div
      class="ambient-drift absolute -bottom-12 right-1/4 size-36 rounded-[2.5rem] bg-brand-200/50"
      style="--drift-duration: 28s; --drift-rot: 40deg; animation-delay: -11s"
    />

    <!-- Brand iconography floating with them: the badge rosette and the
         mission crosshair, barely-there. -->
    <AppIcon
      name="badge"
      class="ambient-drift absolute right-6 top-28 size-16 text-accent-500/20"
      style="--drift-duration: 30s; --drift-rot: -10deg; animation-delay: -5s"
    />
    <AppIcon
      name="missions"
      class="ambient-drift absolute -left-3 bottom-72 size-20 text-brand-400/15"
      style="--drift-duration: 38s; --drift-rot: 8deg; animation-delay: -21s"
    />
  </div>
</template>
