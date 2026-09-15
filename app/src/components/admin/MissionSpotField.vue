<script setup lang="ts">
/**
 * Places one mission on the venue map by clicking it.
 *
 * Nobody types coordinates. The whole reason `mission.spot` is a normalized
 * fraction rather than lat/lng is that an organizer can point at the picture
 * of their own building and be done — no geocoding, no map account, no
 * standing in the outfield with a phone to read off a position.
 *
 * ── Keyboard ──────────────────────────────────────────────────
 * A click-only canvas is unusable without a pointer, and this is a staff tool
 * that has to survive a keyboard and a screen reader. So the canvas IS a
 * button: Enter drops the pin in the middle, arrows nudge it a percent at a
 * time (ten with Shift), and the live position is announced as text. A mouse
 * is faster; a keyboard still finishes the job.
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import RewardMedallion from '../reward/RewardMedallion.vue'
import { useTenantStore } from '../../stores/tenant'

export interface Spot {
  x: number
  y: number
}

const props = defineProps<{ modelValue: Spot | null; color: string }>()
const emit = defineEmits<{ 'update:modelValue': [Spot | null] }>()

const { t } = useI18n()
const tenant = useTenantStore()

const canvas = ref<HTMLButtonElement | null>(null)
const mapUrl = computed(() => tenant.settings.venueMapUrl)

const clamp = (n: number): number => Math.min(1, Math.max(0, n))

function placeFromEvent(event: MouseEvent): void {
  const el = canvas.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  if (!rect.width || !rect.height) return
  emit('update:modelValue', {
    x: clamp((event.clientX - rect.left) / rect.width),
    y: clamp((event.clientY - rect.top) / rect.height),
  })
}

function nudge(dx: number, dy: number, event: KeyboardEvent): void {
  // Nothing placed yet: the first arrow press drops the pin in the middle
  // rather than doing nothing, so the keyboard path has a starting point.
  const current = props.modelValue ?? { x: 0.5, y: 0.5 }
  const step = event.shiftKey ? 0.1 : 0.01
  event.preventDefault()
  emit('update:modelValue', {
    x: clamp(current.x + dx * step),
    y: clamp(current.y + dy * step),
  })
}

function placeCentre(event: KeyboardEvent): void {
  if (props.modelValue) return
  event.preventDefault()
  emit('update:modelValue', { x: 0.5, y: 0.5 })
}

/** Percentages, for the announced position and the pin's offset. */
const pct = computed(() =>
  props.modelValue
    ? { x: Math.round(props.modelValue.x * 100), y: Math.round(props.modelValue.y * 100) }
    : null,
)
</script>

<template>
  <div>
    <p class="block text-xs font-semibold text-brand-900">{{ t('hunts.spotLabel') }}</p>

    <!-- No map uploaded: say where to get one rather than showing a dead
         control. The map is per-tenant, so it lives on Branding. -->
    <p v-if="!mapUrl" class="mt-1 text-xs text-muted">{{ t('hunts.spotNoMap') }}</p>

    <template v-else>
      <p class="mt-0.5 text-xs text-muted">{{ t('hunts.spotHelp') }}</p>

      <button
        ref="canvas"
        type="button"
        class="relative mt-1.5 block w-full overflow-hidden rounded-xl border border-brand-200 bg-brand-50"
        :aria-label="
          pct ? t('hunts.spotPlacedAt', { x: pct.x, y: pct.y }) : t('hunts.spotPlacePrompt')
        "
        @click="placeFromEvent"
        @keydown.up="nudge(0, -1, $event)"
        @keydown.down="nudge(0, 1, $event)"
        @keydown.left="nudge(-1, 0, $event)"
        @keydown.right="nudge(1, 0, $event)"
        @keydown.enter="placeCentre"
      >
        <img :src="mapUrl" alt="" class="block w-full" />

        <span
          v-if="props.modelValue"
          class="pointer-events-none absolute"
          :style="{
            left: `${props.modelValue.x * 100}%`,
            top: `${props.modelValue.y * 100}%`,
            transform: 'translate(-50%, -100%)',
          }"
        >
          <RewardMedallion
            shape="pin"
            tier="silver"
            :crest="props.color"
            emblem="camera"
            class="size-10 drop-shadow-md"
          />
        </span>
      </button>

      <div class="mt-1.5 flex items-center gap-3">
        <p v-if="pct" class="text-xs font-semibold text-muted">
          {{ t('hunts.spotPlacedAt', { x: pct.x, y: pct.y }) }}
        </p>
        <p v-else class="text-xs text-muted">{{ t('hunts.spotUnplaced') }}</p>
        <button
          v-if="props.modelValue"
          type="button"
          class="text-xs font-semibold text-red-600"
          @click="emit('update:modelValue', null)"
        >
          {{ t('hunts.spotClear') }}
        </button>
      </div>
    </template>
  </div>
</template>
