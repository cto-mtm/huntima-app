<script setup lang="ts">
/**
 * The fan's map of a hunt: every located mission drawn on real streets, so a
 * player can see where they still need to go. Renders through the shared
 * LeafletMap (Leaflet + OpenStreetMap), and each pin/area is clickable —
 * tapping one routes to that mission's detail page.
 *
 * ── What this does NOT do ─────────────────────────────────────
 * No "you are here" dot, no location permission prompt, no per-mission
 * geofence. A mission's `geo` is authored by staff and is wayfinding only; a
 * positive `radiusMeters` deliberately blurs the exact point into an area for
 * city-wide hunts. Whether a fan is really at the venue stays the separate
 * soft check against `tenantConfig.venue`, run at capture time.
 *
 * ── Data source ───────────────────────────────────────────────
 * Missions come in as a prop from the cached missions store, so opening this
 * map triggers no network call — the hunt was already loaded once on entry.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import type { Mission } from 'shared'
import LeafletMap, { type MapPoint } from './LeafletMap.vue'
import { useProgressStore } from '../stores/progress'

const props = defineProps<{ missions: Mission[] }>()

const { t } = useI18n()
const router = useRouter()
const progress = useProgressStore()

/** Only located missions can be drawn. The rest are counted, not hidden. */
const points = computed<MapPoint[]>(() =>
  props.missions
    .filter((m) => m.geo !== null)
    .map((m) => ({
      id: m.id,
      lat: m.geo!.lat,
      lng: m.geo!.lng,
      radiusMeters: m.geo!.radiusMeters,
      color: m.color,
      muted: progress.hasBadge(m.id),
    })),
)

const unplacedCount = computed(() => props.missions.length - points.value.length)

function open(id: string): void {
  void router.push({ name: 'mission-detail', params: { id } })
}
</script>

<template>
  <div>
    <div class="h-72 overflow-hidden rounded-card shadow-md shadow-brand-900/5 ring-1 ring-brand-100">
      <LeafletMap :points="points" @select="open" />
    </div>

    <p v-if="unplacedCount" class="mt-2 text-xs text-muted">
      {{ t('hub.mapUnplaced', { count: unplacedCount }) }}
    </p>
  </div>
</template>
