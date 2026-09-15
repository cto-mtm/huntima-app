<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Mission } from 'shared'
import AppIcon from './AppIcon.vue'
import RewardMedallion from './reward/RewardMedallion.vue'
import MapModal from './MapModal.vue'
import type { MapPoint } from './LeafletMap.vue'
import { useMissionText } from '../lib/missionText'
import { useProgressStore } from '../stores/progress'

const props = defineProps<{ mission: Mission }>()

const { t } = useI18n()
const { resolve } = useMissionText()
const progress = useProgressStore()

const earned = computed(() => progress.hasBadge(props.mission.id))

// The near-win beacon (Recipe 11): when exactly one badge remains, every
// still-pending card pulses — any one of them wins it.
const isOneAway = computed(() => progress.remaining === 1 && !earned.value)

// A per-card map affordance: only when the mission has a location. The card
// is itself a link, so the button stops propagation to open the modal
// instead of navigating to the detail page.
const mapOpen = ref(false)
const mapPoints = computed<MapPoint[]>(() => {
  const g = props.mission.geo
  if (!g) return []
  return [{ lat: g.lat, lng: g.lng, radiusMeters: g.radiusMeters, color: props.mission.color }]
})
</script>

<template>
  <RouterLink
    :to="{ name: 'mission-detail', params: { id: props.mission.id } }"
    class="relative flex w-full min-w-0 items-center gap-3 rounded-card bg-surface p-3 shadow-md ring-1 transition-transform duration-150 active:scale-[0.98]"
    :class="earned ? 'ring-accent-400/60 shadow-accent-500/20' : 'ring-brand-100 shadow-brand-900/5'"
    :aria-label="t('missionCard.open')"
  >
    <!-- One-away beacon: a pulsing accent ring overlay. Decorative only —
         the status pill below still carries the semantics. -->
    <!-- The static glow shadow rides the ring's opacity pulse, so the whole
         beacon breathes without ever animating box-shadow itself. -->
    <span
      v-if="isOneAway"
      class="one-away-ring pointer-events-none absolute inset-0 rounded-card ring-2 ring-accent-400 shadow-[0_0_18px_2px] shadow-accent-400/50"
      aria-hidden="true"
    />

    <div class="relative shrink-0">
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
      <!-- Sticker look: a slight tilt (opposite way once earned), a white
           border, and a real shadow. The tilt is baked into the hero
           snapshot, so the morph straightens it out on the detail page — a
           free flourish. -->
      <div
        class="relative flex size-16 items-center justify-center overflow-hidden rounded-xl shadow-md ring-2 ring-white"
        :class="earned ? 'rotate-2' : '-rotate-3'"
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
        <!-- No target photo: most hunts have some. A flat rectangle of the
             mission color reads as an image that failed to load, so the
             placeholder gets a lit edge and a lens mark — it looks like a
             sticker nobody has photographed yet, which is what it is. -->
        <template v-else>
          <span
            class="absolute inset-0"
            style="background: linear-gradient(140deg, rgba(255, 255, 255, 0.35), transparent 55%)"
          />
          <AppIcon name="camera" class="relative size-7 text-white/70" />
        </template>
      </div>

      <!-- The badge you won, pinned to the sticker it came from. Physical
           proof beats a word: the card now shows the OBJECT, and the pill on
           the right only has to name the state. -->
      <RewardMedallion
        v-if="earned"
        shape="rosette"
        tier="gold"
        emblem="badge"
        class="absolute -bottom-1.5 -right-1.5 size-7 drop-shadow"
      />
    </div>

    <div class="min-w-0 flex-1">
      <!-- Second hero pair: proves the recipe generalizes past images. -->
      <!-- Two lines, not `truncate`. A one-line title next to a fixed-width
           pill leaves "The Bat at the Gate" rendering as "The Bat…" on a
           360px phone — which is every phone this is used on. The mission's
           NAME is the row; the pill can be small. -->
      <h3
        class="line-clamp-2 font-bold leading-tight text-brand-900"
        :style="{ viewTransitionName: `mission-title-${props.mission.id}` }"
      >
        {{ resolve(props.mission.title) }}
      </h3>
      <!-- The hint is the actual game. Burying it one tap deep made the list
           a table of contents; two clamped lines make it a set of dares you
           can scan on a concourse. Full text still lives on the detail page. -->
      <p class="mt-1 line-clamp-2 text-xs leading-snug text-muted">
        {{ resolve(props.mission.hint) }}
      </p>
      <p class="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-muted">
        <span
          class="inline-block size-1.5 rounded-full"
          :style="{ backgroundColor: props.mission.color }"
          aria-hidden="true"
        />
        {{ t(`missionCard.kind.${props.mission.kind}`) }}
        <!-- Map affordance: only when the mission has a location. Stops the
             card's own navigation so it opens the map instead. -->
        <button
          v-if="props.mission.geo"
          type="button"
          class="ml-1 inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-brand-700 transition-colors hover:bg-brand-100"
          :aria-label="t('mission.showOnMap')"
          @click.stop.prevent="mapOpen = true"
        >
          <AppIcon name="map" class="size-3" />
        </button>
      </p>
    </div>

    <!-- Pending reads as a dare on the candy CTA gradient — the same surface
         as every other "do it now" control in the app, so the list has one
         obvious next action per row. Earned goes quiet: the medallion on the
         sticker is already carrying the celebration. -->
    <span
      class="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wide shadow-md"
      :class="
        earned
          ? 'bg-success-100 text-success-700 shadow-success-500/10'
          : 'bg-gradient-to-r from-accent-500 to-accent-alt-600 text-white shadow-accent-alt-600/30'
      "
    >
      <AppIcon :name="earned ? 'badge' : 'camera'" class="size-3.5" />
      {{ earned ? t('missionCard.statusEarned') : t('missionCard.statusLocked') }}
    </span>
  </RouterLink>

  <MapModal
    v-if="mapOpen"
    :title="resolve(props.mission.title)"
    :points="mapPoints"
    @close="mapOpen = false"
  />
</template>
