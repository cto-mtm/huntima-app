<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { Mission } from 'shared'
import { useMissionText } from '../lib/missionText'
import { useProgressStore } from '../stores/progress'

const props = defineProps<{ mission: Mission }>()

const { t } = useI18n()
const { resolve } = useMissionText()
const progress = useProgressStore()
</script>

<template>
  <RouterLink
    :to="{ name: 'mission-detail', params: { id: props.mission.id } }"
    class="flex w-full min-w-0 items-center gap-3 rounded-card bg-surface p-3 shadow-sm ring-1 ring-brand-100"
    :aria-label="t('missionCard.open')"
  >
    <!-- ══ HERO SOURCE ══════════════════════════════════════════
         Matches the header block in MissionDetailPage.vue. The name
         MUST be derived from the mission id, never a static string:
         a view-transition-name has to be unique across the document
         at the moment the transition starts, and this renders inside
         a v-for. Two elements sharing a name silently kills the whole
         transition. See docs/animations.md § 1.

         The target photo is the clue, so show it here as a reference
         when one exists; the mission color is the fallback for missions
         that run on the written hint alone. -->
    <div
      class="size-16 shrink-0 overflow-hidden rounded-xl"
      :style="{ backgroundColor: props.mission.color, viewTransitionName: `mission-${props.mission.id}` }"
      aria-hidden="true"
    >
      <img
        v-if="props.mission.targetImageUrl"
        :src="props.mission.targetImageUrl"
        alt=""
        loading="lazy"
        class="size-full object-cover"
      />
    </div>

    <div class="min-w-0 flex-1">
      <!-- Second hero pair: proves the recipe generalizes past images. -->
      <h3
        class="truncate font-semibold text-brand-900"
        :style="{ viewTransitionName: `mission-title-${props.mission.id}` }"
      >
        {{ resolve(props.mission.title) }}
      </h3>
      <p class="mt-0.5 text-xs text-muted">
        {{ t(`missionCard.kind.${props.mission.kind}`) }}
      </p>
    </div>

    <span
      class="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
      :class="
        progress.hasBadge(props.mission.id)
          ? 'bg-green-100 text-green-700'
          : 'bg-red-100 text-red-700'
      "
    >
      {{ progress.hasBadge(props.mission.id) ? t('missionCard.statusEarned') : t('missionCard.statusLocked') }}
    </span>
  </RouterLink>
</template>
