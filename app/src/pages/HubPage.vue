<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppIcon from '../components/AppIcon.vue'
import BaseButton from '../components/BaseButton.vue'
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

// The badge meter. Capped at the target so a hunt with more missions than
// the badge target never shows "6 of 5" or overfills the segments.
const shownCount = computed(() =>
  Math.min(progress.earnedCount, missionsStore.badgeTarget),
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
    <!-- The greeting IS the headline — this is their game, say hi like it. -->
    <h1 class="text-2xl font-extrabold tracking-tight text-brand-900">
      {{ t('hub.greeting', { nickname: displayName }) }}
    </h1>
    <div
      class="mt-1.5 h-1.5 w-16 -skew-x-12 rounded-full bg-gradient-to-r from-accent-400 to-accent-600"
      aria-hidden="true"
    />

    <p
      v-if="missionsStore.loadError && !missionsStore.loading"
      class="mt-3 rounded-lg bg-accent-500/10 px-3 py-2 text-xs font-medium text-accent-600"
    >
      {{ t('hub.loadError') }}
    </p>

    <!-- Badge meter: a game HUD, not a project status bar. One chunky
         segment per badge — kids count segments the way they count hearts
         in a game. The near-win and won states get their own line because
         "one away" is the most motivating state in the whole hunt. -->
    <div
      v-if="missionsStore.badgeTarget > 0 && missionsStore.missions.length"
      class="mt-4 rounded-card bg-surface p-4 shadow-md shadow-brand-900/5 ring-1 ring-brand-100"
    >
      <div class="flex items-center gap-3">
        <div
          class="flex size-11 shrink-0 -rotate-3 items-center justify-center rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 text-white shadow-md shadow-accent-600/40"
          aria-hidden="true"
        >
          <AppIcon name="badge" class="size-6" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-baseline justify-between gap-2">
            <p class="text-sm font-extrabold uppercase tracking-wide text-brand-900">
              {{ t('hub.progressTitle') }}
            </p>
            <p class="text-sm font-extrabold text-accent-600">
              {{ t('hub.progressCount', { count: shownCount, target: missionsStore.badgeTarget }) }}
            </p>
          </div>
          <div class="mt-1.5 flex gap-1" aria-hidden="true">
            <!-- Each segment is a track; the lit fill is an overlay that
                 scales in from the left (Recipe 13), staggered per segment so
                 the bar charges up toward the prize rather than snapping. -->
            <div
              v-for="i in missionsStore.badgeTarget"
              :key="i"
              class="relative h-3 flex-1 overflow-hidden rounded-full bg-brand-100"
            >
              <div
                v-if="i <= shownCount"
                class="meter-fill absolute inset-0 rounded-full bg-gradient-to-r from-accent-400 to-accent-600"
                :style="{ animationDelay: `${(i - 1) * 90}ms` }"
              />
            </div>
          </div>
        </div>
      </div>
      <p
        v-if="progress.remaining === 1"
        class="mt-2.5 flex items-center gap-1.5 text-xs font-bold text-accent-600"
      >
        <AppIcon name="spark" class="size-4 shrink-0" />
        {{ t('hub.oneAway') }}
      </p>
      <div
        v-else-if="progress.isComplete && !progress.redeemed"
        class="mt-3 flex items-center justify-between gap-3"
      >
        <p class="flex items-center gap-1.5 text-xs font-bold text-accent-600">
          <AppIcon name="spark" class="size-4 shrink-0" />
          {{ t('hub.completeReady') }}
        </p>
        <BaseButton size="md" icon="prize" @click="$router.push({ name: 'redeem' })">
          {{ t('hub.claimCta') }}
        </BaseButton>
      </div>
      <p
        v-else-if="progress.isComplete"
        class="mt-2.5 text-xs font-semibold text-muted"
      >
        {{ t('hub.completeClaimed') }}
      </p>
    </div>

    <h2 class="mt-7 text-xl font-extrabold uppercase italic tracking-tight text-brand-900">
      {{ t('hub.title') }}
    </h2>

    <div
      v-if="missionsStore.loaded && !missionsStore.missions.length && !missionsStore.loading"
      class="mt-6 flex flex-col items-center gap-2 text-center"
    >
      <AppIcon name="search" class="size-9 text-brand-200" />
      <p class="text-sm text-muted">{{ t('hub.empty') }}</p>
    </div>

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
