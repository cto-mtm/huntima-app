<script setup lang="ts">
/**
 * The one loading indicator. Anywhere the app waits on data — a hunt loading,
 * a capture verifying, a map fetching tiles — shows THIS, so "we're working"
 * looks the same everywhere and re-skins with the tenant like the rest.
 *
 * ── Why an SVG ring and not a border trick ────────────────────
 * A CSS `border` spinner can only be one flat color and fights the brand
 * gradient the rest of the app is drawn in. This is a stroked SVG arc on
 * `currentColor` with a rounded cap, so it inherits the palette and the size
 * from whatever places it (`text-accent-600`, `size-8`), exactly like AppIcon.
 *
 * ── Accessibility ─────────────────────────────────────────────
 * Decorative by default (`aria-hidden`) — a spinner beside visible "Loading…"
 * text would announce twice. Pass a `label` when the spinner is the ONLY
 * thing on screen, and it becomes a `role="status"` with an accessible name
 * so a screen reader says something is happening.
 *
 * Honors `prefers-reduced-motion`: the ring stops spinning and simply shows,
 * so the indicator never becomes a vestibular trigger (see the media query).
 */
withDefaults(defineProps<{ label?: string }>(), { label: undefined })
</script>

<template>
  <svg
    class="spinner"
    viewBox="0 0 24 24"
    fill="none"
    :role="label ? 'status' : undefined"
    :aria-label="label"
    :aria-hidden="label ? undefined : 'true'"
  >
    <!-- The faint full ring the arc rides on, so the track reads as a circle
         and not a comet with no path. -->
    <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.5" opacity="0.2" />
    <!-- The moving arc: a quarter of the circumference (2πr ≈ 56.5). -->
    <circle
      cx="12"
      cy="12"
      r="9"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-dasharray="14 43"
    />
  </svg>
</template>

<style scoped>
.spinner {
  animation: spinner-rotate 0.8s linear infinite;
  transform-origin: center;
}

@keyframes spinner-rotate {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation: none;
  }
}
</style>
