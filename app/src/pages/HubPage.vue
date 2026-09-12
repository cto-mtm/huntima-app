<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import MissionCard from '../components/MissionCard.vue'
import { useMissionsStore } from '../stores/missions'
import { useProgressStore } from '../stores/progress'
import { useFanName } from '../composables/useFanName'
import { reportFanEvent } from '../lib/analytics'

const { t } = useI18n()
const missionsStore = useMissionsStore()
const progress = useProgressStore()
const { displayName } = useFanName()

// Split the one list into pending and collected on the client — no second
// query. Each group keeps the staff-defined order (the store loads missions
// already sorted by `order`), so pending missions read top-to-bottom the way
// the hunt was authored, with everything already collected settled below.
const pendingMissions = computed(() =>
  missionsStore.missions.filter((m) => !progress.hasBadge(m.id)),
)
const collectedMissions = computed(() =>
  missionsStore.missions.filter((m) => progress.hasBadge(m.id)),
)

// Reaching the hub with a real published hunt on screen (not mid-load, and
// not the empty/error state) is what "participating" means. reportFanEvent
// dedups per device per hunt, so landing here repeatedly counts once.
watch(
  () =>
    missionsStore.loaded && !missionsStore.loading && missionsStore.campaignId
      ? missionsStore.campaignId
      : null,
  (campaignId) => {
    if (campaignId) reportFanEvent(campaignId, 'participant')
  },
  { immediate: true },
)
</script>

<template>
  <section class="py-5">
    <p class="text-sm text-muted">{{ t('hub.greeting', { nickname: displayName }) }}</p>

    <p
      v-if="missionsStore.loadError && !missionsStore.loading"
      class="mt-3 rounded-lg bg-accent-500/10 px-3 py-2 text-xs font-medium text-accent-600"
    >
      {{ t('hub.loadError') }}
    </p>

    <h1 class="mt-6 text-lg font-extrabold text-brand-900">{{ t('hub.title') }}</h1>

    <p
      v-if="missionsStore.loaded && !missionsStore.missions.length && !missionsStore.loading"
      class="mt-4 text-sm text-muted"
    >
      {{ t('hub.empty') }}
    </p>

    <!-- Pending missions, still to collect. Recipe 4 (docs/animations.md):
         TransitionGroup gives the FLIP glide when a mission moves to the
         collected group. `relative` is required because .list-leave-active
         takes leaving items out of flow with position: absolute. The :key
         MUST be the stable mission id — an index key defeats the mechanism. -->
    <TransitionGroup
      v-if="pendingMissions.length"
      name="list"
      tag="div"
      class="relative mt-3 grid grid-cols-1 gap-2.5"
    >
      <MissionCard v-for="mission in pendingMissions" :key="mission.id" :mission="mission" />
    </TransitionGroup>

    <!-- Collected missions, settled beneath the pending ones. -->
    <template v-if="collectedMissions.length">
      <h2 class="mt-8 text-sm font-bold uppercase tracking-wide text-muted">
        {{ t('hub.collectedHeading') }}
      </h2>
      <TransitionGroup
        name="list"
        tag="div"
        class="relative mt-3 grid grid-cols-1 gap-2.5"
      >
        <MissionCard v-for="mission in collectedMissions" :key="mission.id" :mission="mission" />
      </TransitionGroup>
    </template>
  </section>
</template>
