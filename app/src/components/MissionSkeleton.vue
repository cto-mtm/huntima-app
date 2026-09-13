<script setup lang="ts">
/**
 * Loading placeholder for missions (Recipe 15 pulse).
 *
 * One component, two shapes, so every loading state stays in sync with the
 * real layout it stands in for:
 * - 'card'   — mirrors MissionCard.vue's row (tilted thumb, two lines, chip)
 * - 'detail' — mirrors MissionDetailPage.vue (hero block, title, hint card)
 *
 * Purely decorative: the page wrapping a group of these carries
 * `role="status"` and the accessible label (t('common.loading')); the boxes
 * themselves are aria-hidden. Inline animation-delays stagger the shimmer so
 * the pieces breathe in sequence rather than blinking as one.
 */
withDefaults(defineProps<{ variant?: 'card' | 'detail' }>(), { variant: 'card' })
</script>

<template>
  <div
    v-if="variant === 'card'"
    class="flex w-full items-center gap-3 rounded-card bg-surface p-3 shadow-md shadow-brand-900/5 ring-1 ring-brand-100"
    aria-hidden="true"
  >
    <div class="skeleton-pulse size-16 shrink-0 -rotate-3 rounded-xl bg-brand-100" />
    <div class="min-w-0 flex-1">
      <div class="skeleton-pulse h-4 w-3/5 rounded-full bg-brand-100" />
      <div class="skeleton-pulse mt-2 h-3 w-2/5 rounded-full bg-brand-100" style="animation-delay: 120ms" />
    </div>
    <div class="skeleton-pulse h-6 w-16 shrink-0 rounded-full bg-brand-100" style="animation-delay: 240ms" />
  </div>

  <div v-else aria-hidden="true">
    <div class="skeleton-pulse h-44 rounded-card bg-brand-100" />
    <div class="skeleton-pulse mt-4 h-7 w-2/3 rounded-full bg-brand-100" style="animation-delay: 120ms" />
    <div class="skeleton-pulse mt-5 h-24 rounded-card bg-brand-100" style="animation-delay: 240ms" />
  </div>
</template>
