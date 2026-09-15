<script setup lang="ts">
/**
 * The lit display case: up to three trophies on a podium.
 *
 * Deliberately NOT one big SVG. The trophy names are real, arbitrary,
 * translated-or-not strings typed by an organizer — inside an SVG they would
 * need manual truncation, would not wrap, would not respect the user's font
 * size, and would be invisible to text selection. So the furniture is drawn
 * and the content is DOM.
 *
 * The podium always shows three plinths. Empty ones carry a locked cup, which
 * is the honest picture of a shelf with room on it — and reads as an invitation
 * rather than as a bug.
 *
 * Order is "podium order", not list order: the best trophy takes the tall
 * centre plinth with the next two flanking it, exactly the way a podium works.
 * The caller passes trophies already ranked; this component only arranges them.
 */
import { computed } from 'vue'
import RewardMedallion, { type RewardTier } from './RewardMedallion.vue'

export interface ShelfTrophy {
  id: string
  name: string
  tier: RewardTier
}

const props = defineProps<{ trophies: ShelfTrophy[] }>()

/**
 * Plinth layout, left to right. `rank` indexes into the ranked trophy list, so
 * rank 0 — the best — lands on the tall centre plinth.
 */
const PLINTHS = [
  { rank: 1, height: 'h-12', size: 'size-14', pad: 'pb-0' },
  { rank: 0, height: 'h-[4.5rem]', size: 'size-20', pad: 'pb-0' },
  { rank: 2, height: 'h-9', size: 'size-12', pad: 'pb-0' },
] as const

const slots = computed(() =>
  PLINTHS.map((plinth) => ({ ...plinth, trophy: props.trophies[plinth.rank] ?? null })),
)
</script>

<template>
  <div class="showcase relative overflow-hidden rounded-card px-4 pt-6">
    <!-- The spotlight cone. A skewed gradient wedge rather than a filter:
         one paint, no blur cost on a mid-range phone. -->
    <div
      class="pointer-events-none absolute -top-8 left-1/2 h-56 w-56 -translate-x-1/2 opacity-70"
      style="
        background: radial-gradient(
          60% 70% at 50% 0%,
          color-mix(in srgb, var(--color-accent-400) 45%, transparent),
          transparent 70%
        );
      "
      aria-hidden="true"
    />

    <div class="relative flex items-end justify-center gap-2">
      <div v-for="(slot, i) in slots" :key="i" class="flex min-w-0 flex-1 flex-col items-center">
        <!-- An empty plinth is a ghost, not a dimmed trophy: on the dark
             ground a 40%-opacity locked cup sank into the purple and read as
             a smudge. Silver at 55% keeps the SHAPE legible — the point is
             that you can see what is missing. -->
        <RewardMedallion
          shape="cup"
          :tier="slot.trophy ? slot.trophy.tier : 'silver'"
          :class="[slot.size, slot.trophy ? '' : 'opacity-55 saturate-0']"
          class="drop-shadow-lg"
        />
        <!-- Plinth. The top face is a lighter band so the cup reads as
             standing ON it rather than in front of it. -->
        <div
          class="mt-1.5 w-full rounded-t-md bg-showcase-700/80 ring-1 ring-white/10"
          :class="slot.height"
        >
          <div class="h-1.5 w-full rounded-t-md bg-white/15" aria-hidden="true" />
          <p
            v-if="slot.trophy"
            class="line-clamp-2 px-1 pt-1 text-center text-[10px] font-bold leading-tight text-white/85"
            translate="no"
          >
            {{ slot.trophy.name }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
