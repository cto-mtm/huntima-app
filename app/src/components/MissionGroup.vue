<script setup lang="ts">
/**
 * One level of a hunt: a named group of missions that opens and closes.
 *
 * Grouping is DISPLAY ONLY — see the note on `mission.group` in the shared
 * schema. Nothing here gates a mission behind another; a fan can win level 3
 * before level 1, because a locked ladder in a stadium means everyone queues
 * behind whichever mission's subject wandered off.
 *
 * So what is the group FOR? A twenty-mission hunt reads as a wall. Chapters
 * with their own meters turn it into a set of small, finishable things, and a
 * finished chapter is the cheapest win a hunt can hand out.
 *
 * Open by default when anything inside is still pending, collapsed once the
 * level is done: the list should put what is left in front of you and fold
 * away what isn't.
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Mission } from 'shared'
import AppIcon from './AppIcon.vue'
import MissionCard from './MissionCard.vue'
import RewardMedallion from './reward/RewardMedallion.vue'
import { useProgressStore } from '../stores/progress'

const props = defineProps<{
  /** Resolved display name. Null = the hunt's unnamed remainder. */
  label: string | null
  missions: Mission[]
}>()

const { t } = useI18n()
const progress = useProgressStore()

const foundCount = computed(() => props.missions.filter((m) => progress.hasBadge(m.id)).length)
const isComplete = computed(
  () => props.missions.length > 0 && foundCount.value === props.missions.length,
)
const ratio = computed(() =>
  props.missions.length ? foundCount.value / props.missions.length : 0,
)

const open = ref(!isComplete.value)

// Completing the last mission in a level folds it away, which is the payoff
// for finishing one. Re-opening is the fan's call and sticks: only the
// transition INTO complete collapses, never a re-render.
watch(isComplete, (complete, was) => {
  if (complete && !was) open.value = false
})

/** Pending first, collected settled below — the same rule as the flat list. */
const ordered = computed(() => [
  ...props.missions.filter((m) => !progress.hasBadge(m.id)),
  ...props.missions.filter((m) => progress.hasBadge(m.id)),
])
</script>

<template>
  <section class="overflow-hidden rounded-card bg-surface shadow-md shadow-brand-900/5 ring-1 ring-brand-100">
    <!-- The header IS the control. A row-sized tap target matters more here
         than anywhere else in the app: this is the thing a fan hits while
         walking. -->
    <button
      type="button"
      class="flex w-full items-center gap-3 p-3.5 text-left"
      :aria-expanded="open"
      @click="open = !open"
    >
      <RewardMedallion
        shape="rosette"
        :tier="isComplete ? 'gold' : 'locked'"
        :emblem="isComplete ? 'badge' : 'lock'"
        class="size-9"
      />

      <div class="min-w-0 flex-1">
        <div class="flex items-baseline justify-between gap-2">
          <h3 class="line-clamp-2 text-sm font-extrabold uppercase leading-tight tracking-wide text-brand-900">
            <!-- A staff-typed level name is user content; the fallback is
                 ours. `translate="no"` only makes sense on the former, so the
                 caller resolves the label and this just prints it. -->
            {{ props.label ?? t('hub.moreMissions') }}
          </h3>
          <p
            class="shrink-0 text-xs font-extrabold"
            :class="isComplete ? 'text-success-700' : 'text-accent-600'"
          >
            {{ t('hub.levelFound', { count: foundCount, total: props.missions.length }) }}
          </p>
        </div>

        <!-- Continuous meter rather than the hub's segments: a level can hold
             any number of missions, and twenty segments is a barcode. The
             fill is a scaleX transform, so the only animated property is
             transform — the rule, not a workaround. -->
        <div class="mt-1.5 h-2 overflow-hidden rounded-full bg-brand-100">
          <div
            class="h-full origin-left rounded-full transition-transform duration-300 ease-out motion-reduce:transition-none"
            :class="isComplete ? 'bg-success-500' : 'bg-gradient-to-r from-accent-400 to-accent-600'"
            :style="{ transform: `scaleX(${ratio})` }"
            aria-hidden="true"
          />
        </div>
      </div>

      <AppIcon
        name="chevronDown"
        class="size-5 shrink-0 text-muted transition-transform duration-200 motion-reduce:transition-none"
        :class="open ? '' : '-rotate-90'"
      />
    </button>

    <!-- Recipe 18: the panel's HEIGHT changes instantly and its CONTENT
         fades and lifts. Animating height would mean animating a layout
         property every frame, which the animation rules rule out for good
         reason on a mid-range phone. -->
    <Transition name="accordion">
      <div v-show="open" class="grid grid-cols-1 gap-2.5 px-3 pb-3.5">
        <MissionCard v-for="mission in ordered" :key="mission.id" :mission="mission" />
      </div>
    </Transition>
  </section>
</template>
