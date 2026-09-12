<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { verifyResultSchema } from 'shared'
import BaseButton from '../components/BaseButton.vue'
import AppIcon from '../components/AppIcon.vue'
import { useReducedMotion } from '../composables/useReducedMotion'
import { useMissionsStore } from '../stores/missions'
import { useMissionText } from '../lib/missionText'
import { useProgressStore } from '../stores/progress'
import { prepareCapture, type PreparedImage } from '../lib/image'
import { apiPost } from '../lib/api'

const { t } = useI18n()
const { resolve } = useMissionText()
const route = useRoute()
const missionsStore = useMissionsStore()
const progress = useProgressStore()
const reducedMotion = useReducedMotion()

const missionId = computed(() => String(route.params.id))
const mission = computed(() => missionsStore.byId(missionId.value))

type Phase = 'framing' | 'scanning' | 'reward' | 'rejected'
const phase = ref<Phase>('framing')

const capture = ref<PreparedImage | null>(null)
const rejection = ref<string | null>(null)
const stubbed = ref(false)

/** Spyglass missions get a digital zoom; concourse missions don't need one. */
const zoom = ref(1)
const isSpyglass = computed(() => mission.value?.kind === 'spyglass')

const fileInput = ref<HTMLInputElement | null>(null)

function pickPhoto(): void {
  fileInput.value?.click()
}

/**
 * A plain file input with `capture="environment"` opens the rear camera on
 * iOS and Android and returns a real photo — no Capacitor plugin, and it
 * degrades to a file picker on desktop. @capacitor/camera would buy a nicer
 * in-app viewfinder, not a new capability.
 */
async function onFileChosen(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file || !mission.value) return

  phase.value = 'scanning'
  rejection.value = null

  try {
    capture.value = await prepareCapture(file)
  } catch {
    phase.value = 'framing'
    rejection.value = t('capture.imageUnreadable')
    return
  }

  // The verdict is the SERVER's. The client used to award its own badges,
  // which is the same as letting it mint prizes.
  const result = await apiPost<unknown>('/verify-capture', {
    campaignId: missionsStore.campaignId,
    missionId: missionId.value,
    imageBase64: capture.value.base64,
    mimeType: capture.value.mimeType,
  })

  if (!result.ok) {
    // Our failure, not the fan's: never spend their attempt on our outage.
    phase.value = 'framing'
    rejection.value = t('capture.verifyUnavailable')
    return
  }

  // Parse, don't cast. This is the response that decides whether a badge is
  // awarded, so a server that starts returning a different shape must fail
  // loudly here rather than award badges off `undefined`.
  const verdict = verifyResultSchema.safeParse(result.data)
  if (!verdict.success) {
    console.error('[capture] unexpected /verify-capture payload', verdict.error.issues)
    phase.value = 'framing'
    rejection.value = t('capture.verifyUnavailable')
    return
  }

  stubbed.value = verdict.data.stubbed

  if (!verdict.data.match) {
    phase.value = 'rejected'
    rejection.value = verdict.data.reason
    return
  }

  // The celebratory beat is atmosphere, not information — reduced-motion
  // users get the reward immediately.
  const delay = reducedMotion.value ? 0 : 600
  window.setTimeout(() => {
    progress.awardBadge(missionId.value)
    phase.value = 'reward'
  }, delay)
}

function tryAgain(): void {
  capture.value = null
  rejection.value = null
  phase.value = 'framing'
  if (fileInput.value) fileInput.value.value = ''
}
</script>

<template>
  <section v-if="mission" class="py-5">
    <h1 class="text-lg font-extrabold text-brand-900">{{ resolve(mission.title) }}</h1>
    <p class="mt-1 text-sm text-muted">
      {{ isSpyglass ? t('capture.frameSpyglass') : t('capture.framePhoto') }}
    </p>

    <!-- The staff-uploaded target, shown right above the viewfinder because
         the fan is matching against it, not remembering it. -->
    <div v-if="mission.targetImageUrl" class="mt-3">
      <p class="text-xs font-bold uppercase tracking-wide text-muted">
        {{ t('capture.targetLabel') }}
      </p>
      <img
        :src="mission.targetImageUrl"
        alt=""
        class="mt-1 h-32 w-full rounded-card object-cover ring-1 ring-brand-100"
      />
    </div>

    <div class="relative mt-4 aspect-[3/4] overflow-hidden rounded-card bg-brand-900">
      <img
        v-if="capture"
        :src="capture.previewUrl"
        alt=""
        class="absolute inset-0 size-full object-cover"
      />
      <div
        v-else
        class="absolute inset-0 opacity-40 transition-transform duration-200"
        :style="{ backgroundColor: mission.color, transform: `scale(${zoom})` }"
        aria-hidden="true"
      />

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

    <div v-if="isSpyglass && phase === 'framing'" class="mt-4">
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

    <p
      v-if="stubbed && phase !== 'framing'"
      class="mt-4 rounded-lg bg-accent-500/10 px-3 py-2 text-xs font-medium text-accent-600"
    >
      {{ t('capture.stubNotice') }}
    </p>

    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      capture="environment"
      class="sr-only"
      @change="onFileChosen"
    />

    <div v-if="phase === 'framing'" class="mt-4">
      <BaseButton size="lg" @click="pickPhoto">{{ t('capture.capture') }}</BaseButton>
      <p v-if="rejection" class="mt-2 text-center text-sm font-medium text-red-600">
        {{ rejection }}
      </p>
    </div>

    <!-- Strict gate: no match, no badge. The wording carries the whole burden
         of not making a child feel accused of cheating. -->
    <Transition name="reward">
      <div
        v-if="phase === 'rejected'"
        class="mt-6 rounded-card bg-surface p-5 text-center shadow-sm ring-1 ring-red-200"
      >
        <AppIcon name="search" class="mx-auto size-8 text-muted" />
        <h2 class="mt-2 text-lg font-extrabold text-brand-900">{{ t('capture.rejectedTitle') }}</h2>
        <p class="mt-1 text-sm text-muted">{{ rejection ?? t('capture.rejectedBody') }}</p>

        <div class="mt-4 grid gap-2">
          <BaseButton size="lg" @click="tryAgain">{{ t('capture.tryAgain') }}</BaseButton>
          <BaseButton size="lg" variant="secondary" @click="$router.push({ name: 'home' })">
            {{ t('capture.keepGoing') }}
          </BaseButton>
        </div>
      </div>
    </Transition>

    <Transition name="reward">
      <div
        v-if="phase === 'reward'"
        class="mt-6 rounded-card bg-surface p-5 text-center shadow-sm ring-1 ring-accent-400"
      >
        <div
          class="mx-auto flex size-20 items-center justify-center rounded-2xl text-3xl"
          :style="{ backgroundColor: mission.color, viewTransitionName: `badge-${mission.id}` }"
        >
          <AppIcon name="badge" class="size-9 text-white/90" />
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
