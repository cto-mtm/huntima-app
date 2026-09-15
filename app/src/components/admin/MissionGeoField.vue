<script setup lang="ts">
/**
 * Sets a mission's real-world location: a point (lat/lng) plus an optional
 * hint radius, on a Leaflet + OpenStreetMap map.
 *
 * ── How staff set it ──────────────────────────────────────────
 * Click the map to drop/move the point — no typing required — or type exact
 * coordinates into the two number fields when they already know them (a venue
 * address geocoded elsewhere, a spec sheet). The two paths stay in sync: a
 * click fills the fields, an edit moves the pin.
 *
 * ── The radius is a HINT, not a geofence ──────────────────────
 * `radiusMeters` only changes what fans SEE — 0 draws an exact pin, a larger
 * value draws a "somewhere in here" circle for city-wide hunts. It never
 * gates a capture; that stays the separate soft `tenantConfig.venue` check.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import LeafletMap, { type MapPoint } from '../LeafletMap.vue'

export interface Geo {
  lat: number
  lng: number
  radiusMeters: number
}

const props = defineProps<{ modelValue: Geo | null; color: string }>()
const emit = defineEmits<{ 'update:modelValue': [Geo | null] }>()

const { t } = useI18n()

const points = computed<MapPoint[]>(() =>
  props.modelValue
    ? [
        {
          lat: props.modelValue.lat,
          lng: props.modelValue.lng,
          radiusMeters: props.modelValue.radiusMeters,
          color: props.color,
        },
      ]
    : [],
)

/** A map click sets (or moves) the point, preserving any radius already set. */
function onPick(lat: number, lng: number): void {
  emit('update:modelValue', {
    lat: round(lat),
    lng: round(lng),
    radiusMeters: props.modelValue?.radiusMeters ?? 0,
  })
}

/** Six decimals ≈ 0.1 m — plenty, and keeps the stored number tidy. */
const round = (n: number): number => Math.round(n * 1e6) / 1e6

function setField(field: 'lat' | 'lng' | 'radiusMeters', raw: string): void {
  const value = Number(raw)
  if (!Number.isFinite(value)) return
  const base = props.modelValue ?? { lat: 0, lng: 0, radiusMeters: 0 }
  emit('update:modelValue', { ...base, [field]: value })
}
</script>

<template>
  <div>
    <p class="block text-xs font-semibold text-brand-900">{{ t('hunts.geoLabel') }}</p>
    <p class="mt-0.5 text-xs text-muted">{{ t('hunts.geoHelp') }}</p>

    <div
      class="mt-1.5 h-56 overflow-hidden rounded-xl border border-brand-200"
      :aria-label="t('hunts.geoPlacePrompt')"
    >
      <LeafletMap :points="points" pickable @pick="onPick" />
    </div>

    <div class="mt-2 grid grid-cols-2 gap-2">
      <label class="block">
        <span class="text-xs font-semibold text-brand-900">{{ t('hunts.geoLatLabel') }}</span>
        <input
          type="number"
          step="any"
          inputmode="decimal"
          :value="props.modelValue?.lat ?? ''"
          class="mt-1 w-full rounded-lg border border-brand-200 px-2 py-1.5 text-sm"
          @input="setField('lat', ($event.target as HTMLInputElement).value)"
        />
      </label>
      <label class="block">
        <span class="text-xs font-semibold text-brand-900">{{ t('hunts.geoLngLabel') }}</span>
        <input
          type="number"
          step="any"
          inputmode="decimal"
          :value="props.modelValue?.lng ?? ''"
          class="mt-1 w-full rounded-lg border border-brand-200 px-2 py-1.5 text-sm"
          @input="setField('lng', ($event.target as HTMLInputElement).value)"
        />
      </label>
    </div>

    <label class="mt-2 block">
      <span class="text-xs font-semibold text-brand-900">{{ t('hunts.geoRadiusLabel') }}</span>
      <input
        type="number"
        min="0"
        step="10"
        inputmode="numeric"
        :value="props.modelValue?.radiusMeters ?? 0"
        :disabled="!props.modelValue"
        class="mt-1 w-full rounded-lg border border-brand-200 px-2 py-1.5 text-sm disabled:opacity-50"
        @input="setField('radiusMeters', ($event.target as HTMLInputElement).value)"
      />
    </label>
    <p class="mt-0.5 text-xs text-muted">{{ t('hunts.geoRadiusHelp') }}</p>

    <div class="mt-1.5 flex items-center gap-3">
      <p v-if="props.modelValue" class="text-xs font-semibold text-muted">
        {{ t('hunts.geoPlacedAt', { lat: props.modelValue.lat, lng: props.modelValue.lng }) }}
      </p>
      <p v-else class="text-xs text-muted">{{ t('hunts.geoUnplaced') }}</p>
      <button
        v-if="props.modelValue"
        type="button"
        class="text-xs font-semibold text-red-600"
        @click="emit('update:modelValue', null)"
      >
        {{ t('hunts.geoClear') }}
      </button>
    </div>
  </div>
</template>
