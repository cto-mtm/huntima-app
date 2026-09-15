<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Mission, MissionText } from 'shared'
import AppIcon from '../components/AppIcon.vue'
import BaseButton from '../components/BaseButton.vue'
import MissionCard from '../components/MissionCard.vue'
import MissionGroup from '../components/MissionGroup.vue'
import MissionMap from '../components/MissionMap.vue'
import MissionSkeleton from '../components/MissionSkeleton.vue'
import EmptyState from '../components/EmptyState.vue'
import RewardMedallion from '../components/reward/RewardMedallion.vue'
import { useMissionsStore } from '../stores/missions'
import { useProgressStore } from '../stores/progress'
import { useTenantStore } from '../stores/tenant'
import { useFanName } from '../composables/useFanName'
import { useMissionText } from '../lib/missionText'
import { reportFanEvent } from '../lib/analytics'

const { t } = useI18n()
const missionsStore = useMissionsStore()
const progress = useProgressStore()
const tenant = useTenantStore()
const { displayName } = useFanName()
const { resolve } = useMissionText()

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

/**
 * ── Levels ───────────────────────────────────────────────────
 * A hunt is grouped if ANY mission names a level. Ungrouped missions in a
 * grouped hunt fall into one trailing remainder group rather than floating
 * loose above the levels — a half-chaptered list reads as a bug.
 *
 * The bucket key is the group's SHAPE, not its rendered text: two different
 * i18n keys can resolve to the same words in one locale and different words
 * in another, and a hunt must not silently re-chapter itself when a fan
 * switches language.
 */
function groupKey(group: MissionText | null): string {
  if (group === null) return ''
  return 'key' in group ? `k:${group.key}` : `t:${group.text}`
}

const levels = computed<{ key: string; label: string | null; missions: Mission[] }[]>(() => {
  const buckets = new Map<string, { key: string; label: string | null; missions: Mission[] }>()
  // Insertion order follows `order`, which the store has already sorted by,
  // so levels appear in the sequence the hunt was authored in.
  for (const mission of missionsStore.missions) {
    const key = groupKey(mission.group)
    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = { key, label: mission.group ? resolve(mission.group) : null, missions: [] }
      buckets.set(key, bucket)
    }
    bucket.missions.push(mission)
  }
  // The unnamed remainder always sits last, however early its first mission
  // happened to be authored.
  return [...buckets.values()].sort((a, b) => (a.key === '' ? 1 : 0) - (b.key === '' ? 1 : 0))
})

const isGrouped = computed(() => levels.value.some((level) => level.key !== ''))

/**
 * The hunt card's call to action: the next mission still to collect.
 *
 * The mockup puts a START on the hunt cover, and it earns its place — a fan
 * who has just scanned a code is looking at a list and deciding where to
 * begin. Sending them straight at the first pending mission answers that,
 * and once they are underway the same button reads "keep going".
 *
 * Null when everything is collected; the card already has a Claim path then.
 */
const nextMission = computed(() => pendingMissions.value[0] ?? null)

/**
 * ── Map ──────────────────────────────────────────────────────
 * Offered only when at least one mission has a real-world location. An empty
 * map is worse than no map: it teaches the fan the toggle is broken.
 */
const hasMap = computed(() => missionsStore.missions.some((m) => m.geo !== null))
const view = ref<'list' | 'map'>('list')
// A hunt whose map disappears (a re-brand, a different org) must not strand
// the fan on a blank view.
watch(hasMap, (available) => {
  if (!available) view.value = 'list'
})

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
    if (campaignId && missionsStore.slug) {
      reportFanEvent(missionsStore.slug, campaignId, 'participant')
      // Landing on a real published hub IS joining — record it as an ongoing
      // game so it surfaces on the platform home with a Continue button.
      progress.recordJoin({
        tenantSlug: missionsStore.slug,
        teamName: tenant.settings.teamName,
        campaignId,
        badgeTarget: missionsStore.badgeTarget,
        joinedAt: Date.now(),
      })
    }
  },
  { immediate: true },
)
</script>

<template>
  <section class="py-5">
    <!-- The greeting IS the headline — this is their game, say hi like it.
         Display skin: chunky face, candy gradient, brand outline (main.css). -->
    <h1 class="display-title display-title--sm text-3xl">
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

    <!-- ── The hunt card ────────────────────────────────────────
         Badge meter, the hunt's own name, and the prize it pays out — the
         three things a fan needs before deciding to start walking. A game
         HUD, not a project status bar: one chunky segment per badge, the way
         a kid counts hearts. The near-win and won states get their own line
         because "one away" is the most motivating state in the whole hunt. -->
    <div
      v-if="missionsStore.badgeTarget > 0 && missionsStore.missions.length"
      class="mt-4 overflow-hidden rounded-card bg-surface shadow-md shadow-brand-900/5 ring-1 ring-brand-100"
    >
      <!-- The prize photo doubles as the hunt's cover. No separate cover
           asset to author, and it puts what they are playing for at the top
           of the screen rather than behind a tab. -->
      <img
        v-if="missionsStore.prize?.imageUrl"
        :src="missionsStore.prize.imageUrl"
        alt=""
        class="h-24 w-full object-cover"
      />

      <div class="p-4">
        <div class="flex items-center gap-3">
          <RewardMedallion
            shape="rosette"
            :tier="progress.isComplete ? 'gold' : 'silver'"
            emblem="badge"
            class="size-11 -rotate-3"
          />
          <div class="min-w-0 flex-1">
            <div class="flex items-baseline justify-between gap-2">
              <p
                v-if="missionsStore.name"
                class="line-clamp-2 text-sm font-extrabold uppercase leading-tight tracking-wide text-brand-900"
                translate="no"
              >
                {{ missionsStore.name }}
              </p>
              <p v-else class="text-sm font-extrabold uppercase tracking-wide text-brand-900">
                {{ t('hub.progressTitle') }}
              </p>
              <p class="shrink-0 text-sm font-extrabold text-accent-600">
                {{ t('hub.progressCount', { count: shownCount, target: missionsStore.badgeTarget }) }}
              </p>
            </div>
            <div class="mt-1.5 flex gap-1" aria-hidden="true">
              <!-- Each segment is a track; the lit fill is an overlay that
                   scales in from the left (Recipe 13), staggered per segment
                   so the bar charges up toward the prize rather than
                   snapping. -->
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

        <!-- START. Deliberately below the meter and full width: it is the one
             thing to press on this screen, and a fan holding the phone
             one-handed on a concourse should not have to aim. -->
        <div v-if="nextMission && !progress.isComplete" class="mt-3.5">
          <BaseButton
            size="lg"
            icon="camera"
            @click="$router.push({ name: 'mission-detail', params: { id: nextMission.id } })"
          >
            {{ progress.earnedCount ? t('hub.continueCta') : t('hub.startCta') }}
          </BaseButton>
        </div>
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
    </div>

    <!-- ── Section head + view toggle ───────────────────────── -->
    <div class="mt-7 flex items-center justify-between gap-3">
      <h2 class="text-xl font-extrabold uppercase italic tracking-tight text-brand-900">
        {{ t('hub.title') }}
      </h2>

      <!-- Only when there is actually a map with pins on it. A toggle that
           leads to an empty picture teaches the fan it is broken. -->
      <div
        v-if="hasMap"
        class="flex shrink-0 rounded-full bg-brand-100 p-0.5"
        role="group"
        :aria-label="t('hub.viewLabel')"
      >
        <button
          v-for="option in (['list', 'map'] as const)"
          :key="option"
          type="button"
          class="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition-transform duration-150 active:scale-95"
          :class="view === option ? 'bg-brand-600 text-white shadow-sm' : 'text-brand-700'"
          :aria-pressed="view === option"
          @click="view = option"
        >
          <AppIcon :name="option" class="size-4" />
          {{ t(option === 'list' ? 'hub.viewList' : 'hub.viewMap') }}
        </button>
      </div>
    </div>

    <!-- Skeleton list while /missions is in flight (Recipe 15). Only when
         there is nothing to show yet — a refetch with cards already on
         screen must not blank them into placeholders. -->
    <div
      v-if="missionsStore.loading && !missionsStore.missions.length"
      class="mt-3 grid grid-cols-1 gap-2.5"
      role="status"
      :aria-label="t('common.loading')"
    >
      <MissionSkeleton v-for="i in 4" :key="i" />
    </div>

    <!-- No published hunt. This is the FIRST screen a fan sees when they
         scan a code before the org has gone live, so it shows the badge they
         are about to start collecting rather than a shrug. -->
    <EmptyState
      v-if="missionsStore.loaded && !missionsStore.missions.length && !missionsStore.loading"
      shape="rosette"
      :title="t('hub.emptyTitle')"
      :body="t('hub.empty')"
    />

    <!-- ── Map view ─────────────────────────────────────────── -->
    <template v-if="view === 'map' && hasMap">
      <p class="mt-2 text-xs text-muted">{{ t('hub.mapHint') }}</p>
      <MissionMap class="mt-3" :missions="missionsStore.missions" />
    </template>

    <!-- ── Levels ───────────────────────────────────────────── -->
    <div v-else-if="isGrouped" class="mt-3 grid grid-cols-1 gap-2.5">
      <MissionGroup
        v-for="level in levels"
        :key="level.key"
        :label="level.label"
        :missions="level.missions"
      />
    </div>

    <!-- ── Flat list ────────────────────────────────────────── -->
    <template v-else>
      <!-- Pending missions, still to collect. Recipe 4 (docs/animations.md):
           TransitionGroup gives the FLIP glide when a mission moves to the
           collected group. `relative` is required because .list-leave-active
           takes leaving items out of flow with position: absolute. The :key
           MUST be the stable mission id — an index key defeats the
           mechanism. -->
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
    </template>
  </section>
</template>
