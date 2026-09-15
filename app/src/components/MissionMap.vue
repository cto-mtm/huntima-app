<script setup lang="ts">
/**
 * The venue map: missions pinned onto a plan of the building.
 *
 * ── Why this is an illustration, not a tile layer ─────────────
 * A street map would need a tile provider (an API key, a per-load bill, and
 * a third-party origin in the CSP), would render a concrete bowl as a grey
 * blob with no concourse in it, and would be useless with the signal a phone
 * actually gets inside a stadium. An organizer's own plan — the seating
 * chart, the vineyard map, the conference floor — is the picture a fan needs,
 * loads as one image, and white-labels for free.
 *
 * ── What this does NOT do ─────────────────────────────────────
 * It does not know where the fan is. There is no "you are here" dot, no
 * location permission prompt, and no per-mission geofence. Pins are placed by
 * staff at authoring time in normalized coordinates (`mission.spot`), so
 * drawing this map asks the device for nothing.
 *
 * Whether a fan is really at the venue stays exactly where it already was:
 * the soft `useGeofence` check against `tenantConfig.venue`, run at capture
 * time. Wiring per-mission GPS into a wayfinding picture would open the
 * geofencing seam sideways — see docs/architecture.md § Seams left open.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Mission } from 'shared'
import RewardMedallion from './reward/RewardMedallion.vue'
import { useMissionText } from '../lib/missionText'
import { useProgressStore } from '../stores/progress'

const props = defineProps<{ missions: Mission[]; mapUrl: string }>()

const { t } = useI18n()
const { resolve } = useMissionText()
const progress = useProgressStore()

/** Only placed missions can be drawn. The rest are counted, not hidden. */
const placed = computed(() => props.missions.filter((m) => m.spot !== null))
const unplacedCount = computed(() => props.missions.length - placed.value.length)
</script>

<template>
  <div>
    <div class="relative overflow-hidden rounded-card bg-brand-50 shadow-md shadow-brand-900/5 ring-1 ring-brand-100">
      <!-- The plan sets the height: an organizer's map can be any aspect
           ratio, and cropping it to a fixed one is how a pin ends up off the
           edge of its own landmark. -->
      <img :src="props.mapUrl" alt="" class="block w-full" />

      <RouterLink
        v-for="mission in placed"
        :key="mission.id"
        :to="{ name: 'mission-detail', params: { id: mission.id } }"
        class="absolute transition-transform duration-150 active:scale-95"
        :style="{
          left: `${(mission.spot?.x ?? 0) * 100}%`,
          top: `${(mission.spot?.y ?? 0) * 100}%`,
          /* The pin's TIP is the location, not its centre — so the anchor
             sits at the bottom of the drop and the art hangs above it. */
          transform: 'translate(-50%, -100%)',
        }"
        :aria-label="resolve(mission.title)"
      >
        <RewardMedallion
          shape="pin"
          :tier="progress.hasBadge(mission.id) ? 'gold' : 'silver'"
          :crest="mission.color"
          :emblem="progress.hasBadge(mission.id) ? 'badge' : 'camera'"
          class="size-10 drop-shadow-md"
        />
      </RouterLink>
    </div>

    <p v-if="unplacedCount" class="mt-2 text-xs text-muted">
      {{ t('hub.mapUnplaced', { count: unplacedCount }) }}
    </p>
  </div>
</template>
