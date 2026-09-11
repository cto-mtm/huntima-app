<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import BaseButton from '../components/BaseButton.vue'
import { useReducedMotion } from '../composables/useReducedMotion'
import { useMissionsStore } from '../stores/missions'
import { useProgressStore } from '../stores/progress'

const { t } = useI18n()
const route = useRoute()
const missionsStore = useMissionsStore()
const progress = useProgressStore()
const reducedMotion = useReducedMotion()

const missionId = computed(() => String(route.params.id))
const mission = computed(() => missionsStore.byId(missionId.value))

type Phase = 'framing' | 'scanning' | 'reward'
const phase = ref<Phase>('framing')

/** Spyglass missions get a digital zoom; concourse missions don't need one. */
const zoom = ref(1)
const isSpyglass = computed(() => mission.value?.kind === 'spyglass')

/**
 * SEAM — this is the whole capture pipeline, stubbed.
 *
 * The real implementation replaces the timer with, in order:
 *   1. @capacitor/camera to take the photo
 *   2. @capacitor/geolocation checked against tenant.geofence
 *   3. for spyglass missions, an OCR call on the cropped target box
 *   4. server-side verification before awarding — a client that awards
 *      its own badges is a client that can mint its own prizes
 *
 * The contract to preserve is the tail of this function: award the badge,
 * then show the reward. Everything above it is replaceable.
 */
function simulateCapture(): void {
  if (!mission.value) return

  phase.value = 'scanning'

  // Reduced-motion users get the result immediately; the "Scanning…" beat
  // is atmosphere, not information.
  const delay = reducedMotion.value ? 0 : 900

  window.setTimeout(() => {
    progress.awardBadge(missionId.value)
    phase.value = 'reward'
  }, delay)
}
</script>

<template>
  <section v-if="mission" class="py-5">
    <h1 class="text-lg font-extrabold text-brand-900">{{ t(mission.titleKey) }}</h1>
    <p class="mt-1 text-sm text-muted">
      {{ isSpyglass ? t('capture.frameSpyglass') : t('capture.framePhoto') }}
    </p>

    <!-- Viewfinder stand-in. When @capacitor/camera lands, the live preview
         renders here and this block becomes the overlay on top of it. -->
    <div class="relative mt-4 aspect-[3/4] overflow-hidden rounded-card bg-brand-900">
      <div
        class="absolute inset-0 opacity-40 transition-transform duration-200"
        :style="{ backgroundColor: mission.color, transform: `scale(${zoom})` }"
        aria-hidden="true"
      />

      <!-- Targeting box: the "spyglass" framing guide. For spyglass
           missions this rectangle is also the OCR crop region. -->
      <div
        class="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 border-white/90"
        :class="isSpyglass ? 'size-40' : 'size-56'"
        aria-hidden="true"
      />

      <p
        v-if="phase === 'scanning'"
        class="absolute inset-x-0 bottom-6 text-center text-sm font-semibold text-white"
      >
        {{ t('capture.scanning') }}
      </p>
    </div>

    <div v-if="isSpyglass" class="mt-4">
      <label for="zoom" class="block text-xs font-semibold text-muted">
        {{ t('capture.zoomLabel') }}
      </label>
      <input
        id="zoom"
        v-model.number="zoom"
        type="range"
        min="1"
        max="4"
        step="0.1"
        class="mt-1 w-full accent-brand-600"
      />
    </div>

    <p class="mt-4 rounded-lg bg-accent-500/10 px-3 py-2 text-xs font-medium text-accent-600">
      {{ t('capture.stubNotice') }}
    </p>

    <div class="mt-4">
      <BaseButton size="lg" :disabled="phase !== 'framing'" @click="simulateCapture">
        {{ t('capture.capture') }}
      </BaseButton>
    </div>

    <!-- Recipe 5 (docs/animations.md): scale + fade only. This is a
         within-page state change, so it uses Vue's <Transition>, not a
         view transition — those are strictly page-to-page. -->
    <Transition name="reward">
      <div
        v-if="phase === 'reward'"
        class="mt-6 rounded-card bg-surface p-5 text-center shadow-sm ring-1 ring-accent-400"
      >
        <div
          class="mx-auto flex size-20 items-center justify-center rounded-2xl text-3xl"
          :style="{ backgroundColor: mission.color, viewTransitionName: `badge-${mission.id}` }"
        >
          <span aria-hidden="true">🏅</span>
        </div>
        <h2 class="mt-3 text-xl font-extrabold text-brand-900">{{ t('capture.successTitle') }}</h2>
        <p class="mt-1 text-sm text-muted">{{ t('capture.successBody') }}</p>

        <div class="mt-4 grid gap-2">
          <BaseButton size="lg" @click="$router.push({ name: 'home' })">
            {{ t('capture.keepGoing') }}
          </BaseButton>
          <BaseButton size="lg" variant="secondary" @click="$router.push({ name: 'trophies' })">
            {{ t('capture.viewTrophies') }}
          </BaseButton>
        </div>
      </div>
    </Transition>
  </section>

  <section v-else class="py-10 text-center">
    <p class="text-sm text-muted">{{ t('mission.notFound') }}</p>
    <div class="mt-4">
      <BaseButton variant="secondary" @click="$router.push({ name: 'home' })">
        {{ t('mission.backToMissions') }}
      </BaseButton>
    </div>
  </section>
</template>
