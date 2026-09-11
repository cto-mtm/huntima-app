<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMissionsStore } from '../stores/missions'
import { useProgressStore } from '../stores/progress'

const { t } = useI18n()
const missionsStore = useMissionsStore()
const progress = useProgressStore()

/**
 * Fixed-length slot list: the empty slots are the point. A fan should see
 * how many are left without counting, the way a sticker album shows gaps.
 */
const slots = computed(() => {
  const earned = progress.earnedIds
    .map((id) => missionsStore.byId(id))
    .filter((m): m is NonNullable<typeof m> => m !== null)

  const target = missionsStore.badgeTarget
  return Array.from({ length: target }, (_, i) => earned[i] ?? null)
})
</script>

<template>
  <section class="rounded-card bg-surface p-4 shadow-sm ring-1 ring-brand-100">
    <div class="flex items-baseline justify-between">
      <h2 class="text-sm font-bold uppercase tracking-wide text-brand-900">
        {{ t('trophyCase.title') }}
      </h2>
      <span class="text-xs font-medium text-muted">
        {{ t('trophyCase.progress', { earned: progress.earnedCount, target: missionsStore.badgeTarget }) }}
      </span>
    </div>

    <ul class="mt-3 flex gap-2">
      <li v-for="(slot, index) in slots" :key="index" class="flex-1">
        <div
          v-if="slot"
          class="flex aspect-square items-center justify-center rounded-xl text-lg"
          :style="{ backgroundColor: slot.color, viewTransitionName: `badge-${slot.id}` }"
          :title="t(slot.titleKey)"
        >
          <span aria-hidden="true">🏅</span>
          <span class="sr-only">{{ t(slot.titleKey) }}</span>
        </div>
        <div
          v-else
          class="flex aspect-square items-center justify-center rounded-xl border-2 border-dashed border-brand-100"
          :aria-label="t('trophyCase.emptySlot')"
        />
      </li>
    </ul>

    <p v-if="progress.isComplete" class="mt-3 text-sm font-semibold text-accent-600">
      {{ t('trophyCase.complete') }}
    </p>
  </section>
</template>
