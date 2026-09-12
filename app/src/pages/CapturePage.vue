<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { verifyResultSchema } from 'shared'
import BaseButton from '../components/BaseButton.vue'
import AppIcon from '../components/AppIcon.vue'
import { useReducedMotion } from '../composables/useReducedMotion'
import { useGeofence } from '../composables/useGeofence'
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
const geofence = useGeofence()

const missionId = computed(() => String(route.params.id))
const mission = computed(() => missionsStore.byId(missionId.value))

type Phase = 'framing' | 'scanning' | 'reward' | 'rejected'
const phase = ref<Phase>('framing')

const capture = ref<PreparedImage | null>(null)
const rejection = ref<string | null>(null)
const stubbed = ref(false)

/** True when THIS capture was the one that completed the hunt — the reward
 *  card upgrades from "badge unlocked" to the full hunt-complete moment. */
const justCompleted = ref(false)

/**
 * Confetti burst for the reward card (Recipe 9). Each piece is a DOM span
 * whose arc lives in inline custom props: a mid keyframe that rises and an
 * end keyframe that falls past it, so the "gravity" is faked entirely with
 * transform. Colors come from the mission plus the brand/accent tokens, so
 * the burst re-skins with the tenant like everything else.
 */
interface ConfettiPiece {
  id: number
  style: Record<string, string>
}

function makeConfetti(missionColor: string, count: number): ConfettiPiece[] {
  const palette = [
    missionColor,
    'var(--color-accent-400)',
    'var(--color-accent-600)',
    'var(--color-brand-400)',
    '#ffffff',
  ]
  return Array.from({ length: count }, (_, i) => {
    // Evenly fanned with jitter, so the burst always covers the circle.
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.6
    const distance = 70 + Math.random() * 90
    const size = 5 + Math.random() * 5
    const rot = (Math.random() - 0.5) * 540
    return {
      id: i,
      style: {
        backgroundColor: palette[i % palette.length],
        width: `${size.toFixed(1)}px`,
        height: `${(size * (Math.random() > 0.5 ? 1.8 : 1)).toFixed(1)}px`,
        borderRadius: Math.random() > 0.6 ? '9999px' : '2px',
        animationDelay: `${Math.round(Math.random() * 120)}ms`,
        '--confetti-mid-x': `${(Math.cos(angle) * distance * 0.7).toFixed(1)}px`,
        '--confetti-mid-y': `${(Math.sin(angle) * distance * 0.7 - 30).toFixed(1)}px`,
        '--confetti-mid-rot': `${(rot * 0.6).toFixed(0)}deg`,
        '--confetti-end-x': `${(Math.cos(angle) * distance).toFixed(1)}px`,
        '--confetti-end-y': `${(Math.sin(angle) * distance + 60).toFixed(1)}px`,
        '--confetti-end-rot': `${rot.toFixed(0)}deg`,
      },
    }
  })
}

const confetti = ref<ConfettiPiece[]>([])

/** Haptic beat to pair with the visual one. Vibration is physical motion,
 *  so it respects reduced motion; a no-vibrate device just skips it. */
function buzz(pattern: number | number[]): void {
  if (reducedMotion.value) return
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // Some WebViews throw instead of ignoring — the beat is optional.
  }
}

/** Progress shown in the reward card. Capped at the target so a hunt with
 *  more missions than the badge target never reads "6 of 5". */
const shownCount = computed(() =>
  Math.min(progress.earnedCount, missionsStore.badgeTarget),
)

/**
 * prepareCapture's previewUrl is now an object URL (created from the
 * compressed blob), so it must be revoked or it leaks for the life of the
 * tab. Release the current one before replacing or clearing it.
 */
function releasePreview(): void {
  if (capture.value) {
    URL.revokeObjectURL(capture.value.previewUrl)
  }
}

onBeforeUnmount(releasePreview)

/** Spyglass missions get a digital zoom; concourse missions don't need one. */
const zoom = ref(1)
const isSpyglass = computed(() => mission.value?.kind === 'spyglass')

const fileInput = ref<HTMLInputElement | null>(null)
const locating = ref(false)

async function pickPhoto(): Promise<void> {
  // If the club set a stadium geofence, make sure the fan is roughly there
  // before opening the camera. Soft gate — see useGeofence; a denied or fuzzy
  // location resolves to 'ok', so it only ever stops someone who is clearly
  // somewhere else.
  rejection.value = null
  locating.value = true
  const verdict = await geofence.check()
  locating.value = false
  if (verdict === 'out-of-range') {
    rejection.value = t('capture.outOfRange')
    return
  }
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
  const startedAt = Date.now()

  try {
    releasePreview()
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

  // Hold the "checking" state on screen for a minimum beat so an instant
  // (stubbed) verdict still reads as a real check — the result must never look
  // like it landed before the photo was even examined. The scan animation
  // fills this time; reduced-motion users skip straight to the outcome.
  const MIN_SCAN_MS = reducedMotion.value ? 0 : 1100
  await new Promise((resolve) =>
    window.setTimeout(resolve, Math.max(0, MIN_SCAN_MS - (Date.now() - startedAt))),
  )

  if (!verdict.data.match) {
    phase.value = 'rejected'
    rejection.value = verdict.data.reason
    buzz([20, 60, 20])
    return
  }

  // Award only now, after the check has visibly completed. The award is the
  // state change; everything after it is celebration and may be skipped
  // (reduced motion) without the fan losing anything.
  const wasComplete = progress.isComplete
  progress.awardBadge(missionId.value)
  justCompleted.value = !wasComplete && progress.isComplete

  confetti.value = reducedMotion.value
    ? []
    : makeConfetti(mission.value?.color ?? 'var(--color-accent-500)', justCompleted.value ? 28 : 18)
  buzz(justCompleted.value ? [20, 60, 20, 60, 80] : [15, 60, 40])
  phase.value = 'reward'
}

function tryAgain(): void {
  releasePreview()
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

    <div class="relative mt-4 aspect-[3/4] overflow-hidden rounded-card bg-gradient-to-b from-brand-900 to-brand-950">
      <!-- Captured photo. -->
      <img
        v-if="capture"
        :src="capture.previewUrl"
        alt=""
        class="absolute inset-0 size-full object-cover"
      />

      <!-- Framing placeholder: a viewfinder, not a flat color block. A faint
           wash of the mission color keeps its identity; the icon and hint say
           what to do. -->
      <template v-else>
        <div
          class="absolute inset-0 opacity-25 transition-transform duration-200"
          :style="{
            background: `radial-gradient(60% 45% at 50% 42%, ${mission.color}, transparent 75%)`,
            transform: `scale(${zoom})`,
          }"
          aria-hidden="true"
        />
        <div class="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/60">
          <AppIcon name="camera" class="size-10" />
          <p class="max-w-[14rem] text-center text-xs font-medium">
            {{ t('capture.viewfinderHint') }}
          </p>
        </div>
      </template>

      <!-- Aim frame: corner brackets, tighter for spyglass. -->
      <div
        class="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        :class="isSpyglass ? 'size-40' : 'size-56'"
        aria-hidden="true"
      >
        <span class="absolute left-0 top-0 size-6 rounded-tl-lg border-l-2 border-t-2 border-white/80" />
        <span class="absolute right-0 top-0 size-6 rounded-tr-lg border-r-2 border-t-2 border-white/80" />
        <span class="absolute bottom-0 left-0 size-6 rounded-bl-lg border-b-2 border-l-2 border-white/80" />
        <span class="absolute bottom-0 right-0 size-6 rounded-br-lg border-b-2 border-r-2 border-white/80" />
      </div>

      <!-- Checking: a scan band sweeps the frame while /verify-capture runs. -->
      <div
        v-if="phase === 'scanning'"
        class="capture-scan pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-white/25 to-transparent"
        aria-hidden="true"
      />
      <p
        v-if="phase === 'scanning'"
        class="absolute inset-x-0 bottom-6 text-center text-sm font-semibold text-white"
      >
        {{ t('capture.scanning') }}
      </p>

      <!-- The verdict landing: one white flash over the photo (Recipe 9),
           the beat between "checking…" and the badge popping below. -->
      <div
        v-if="phase === 'reward'"
        class="capture-flash pointer-events-none absolute inset-0 bg-white"
        aria-hidden="true"
      />
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
      <BaseButton size="lg" icon="camera" :disabled="locating" @click="pickPhoto">
        {{ locating ? t('capture.locating') : t('capture.capture') }}
      </BaseButton>
      <p v-if="rejection" class="mt-2 text-center text-sm font-medium text-red-600">
        {{ rejection }}
      </p>
    </div>

    <!-- Strict gate: no match, no badge. The wording carries the whole burden
         of not making a child feel accused of cheating; the shake (Recipe 8)
         draws the eye without scolding. -->
    <Transition name="retry">
      <div
        v-if="phase === 'rejected'"
        class="mt-6 rounded-card bg-surface p-5 text-center shadow-sm ring-1 ring-red-200"
      >
        <AppIcon name="search" class="mx-auto size-8 text-muted" />
        <h2 class="mt-2 text-lg font-extrabold text-brand-900">{{ t('capture.rejectedTitle') }}</h2>
        <p class="mt-1 text-sm text-muted">{{ rejection ?? t('capture.rejectedBody') }}</p>

        <div class="mt-4 grid gap-2">
          <BaseButton size="lg" icon="camera" @click="tryAgain">{{ t('capture.tryAgain') }}</BaseButton>
          <BaseButton size="lg" variant="secondary" icon="missions" @click="$router.push({ name: 'home' })">
            {{ t('capture.keepGoing') }}
          </BaseButton>
        </div>
      </div>
    </Transition>

    <Transition name="reward">
      <div
        v-if="phase === 'reward'"
        class="mt-6 rounded-card bg-surface p-5 text-center shadow-lg shadow-accent-500/20 ring-1 ring-accent-400"
      >
        <div class="relative mx-auto size-20">
          <!-- Mission-colored halo, breathing via opacity (Recipe 9). A
               static radial gradient — glow is painted once, never an
               animated box-shadow. -->
          <span
            class="badge-halo absolute -inset-5 rounded-full opacity-50"
            :style="{ background: `radial-gradient(closest-side, ${mission.color}, transparent)` }"
            aria-hidden="true"
          />
          <span class="badge-ring absolute inset-0 rounded-2xl bg-accent-400" aria-hidden="true" />
          <div
            class="badge-pop relative flex size-20 items-center justify-center rounded-2xl"
            :style="{ backgroundColor: mission.color, viewTransitionName: `badge-${mission.id}` }"
          >
            <AppIcon name="badge" class="size-9 text-white/90" />
          </div>
          <!-- Confetti burst (Recipe 9): pieces fan out from the badge center
               and arc down past the card edge. Empty under reduced motion. -->
          <span
            v-for="piece in confetti"
            :key="piece.id"
            class="confetti-piece pointer-events-none absolute left-1/2 top-1/2 -ml-1 -mt-1"
            :style="piece.style"
            aria-hidden="true"
          />
        </div>
        <h2 class="mt-3 text-xl font-extrabold text-brand-900">
          {{ justCompleted ? t('capture.huntCompleteTitle') : t('capture.successTitle') }}
        </h2>
        <p class="mt-1 text-sm text-muted">
          {{ justCompleted ? t('capture.huntCompleteBody') : t('capture.successBody') }}
        </p>

        <!-- The meter tick: every win visibly moves the count toward the
             prize. The newest dot pops in after the badge lands. -->
        <template v-if="missionsStore.badgeTarget > 0">
          <p class="mt-4 text-xs font-bold uppercase tracking-wide text-muted">
            {{ t('capture.progressCount', { count: shownCount, target: missionsStore.badgeTarget }) }}
          </p>
          <div class="mt-2 flex justify-center gap-1.5" aria-hidden="true">
            <span
              v-for="i in missionsStore.badgeTarget"
              :key="i"
              class="size-2.5 rounded-full"
              :class="[
                i <= shownCount ? 'bg-accent-500' : 'bg-brand-100',
                i === shownCount ? 'badge-dot-pop' : '',
              ]"
            />
          </div>
        </template>

        <div class="mt-4 grid gap-2">
          <BaseButton v-if="justCompleted" size="lg" icon="prize" @click="$router.push({ name: 'redeem' })">
            {{ t('capture.claimPrize') }}
          </BaseButton>
          <BaseButton v-else size="lg" icon="missions" @click="$router.push({ name: 'home' })">
            {{ t('capture.keepGoing') }}
          </BaseButton>
          <BaseButton
            size="lg"
            variant="secondary"
            :icon="justCompleted ? 'missions' : 'trophies'"
            @click="$router.push({ name: justCompleted ? 'home' : 'trophies' })"
          >
            {{ justCompleted ? t('capture.keepGoing') : t('capture.viewTrophies') }}
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
