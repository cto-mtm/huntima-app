<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { verifyResultSchema } from 'shared'
import BaseButton from '../components/BaseButton.vue'
import AppIcon from '../components/AppIcon.vue'
import CaptureCelebration from '../components/CaptureCelebration.vue'
import { useReducedMotion } from '../composables/useReducedMotion'
import { useGeofence } from '../composables/useGeofence'
import { useMissionsStore } from '../stores/missions'
import { useMissionText } from '../lib/missionText'
import { useProgressStore } from '../stores/progress'
import { prepareCapture, type PreparedImage } from '../lib/image'
import { takePendingCapture } from '../lib/pendingCapture'
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

/**
 * The normal entry: the fan already took the photo on the mission page, so
 * this screen opens on "checking…" rather than on a drawn viewfinder and a
 * second button.
 *
 * Nothing pending means a refresh or a link straight to this URL. That fan has
 * no photo, so the framing state below is still the fallback — it is now an
 * edge case rather than the path everyone walks.
 */
onMounted(() => {
  const pending = takePendingCapture()
  if (pending) void verify(pending)
})

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
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  // Reset either way: re-picking the SAME file must still fire a change
  // event, which it will not while the value is still set.
  input.value = ''
  if (!file) return
  await verify(file)
}

/**
 * Everything from a File to a verdict. Split out of the change handler
 * because the photo now usually arrives from the mission page (the camera has
 * to open inside the tap that asks for it — see lib/pendingCapture), and only
 * a retry or a deep link goes through the input on this page.
 */
async function verify(file: File): Promise<void> {
  if (!mission.value) return

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
  // which is the same as letting it mint prizes. Scoped to the org so a
  // campaignId can never resolve against another club's hunt.
  const result = await apiPost<unknown>(`/t/${missionsStore.slug}/verify-capture`, {
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

  buzz(justCompleted.value ? [20, 60, 20, 60, 80] : [15, 60, 40])
  phase.value = 'reward'
}

/**
 * Retry re-opens the camera immediately rather than returning to the framing
 * screen. The tap on "Try again" IS a user gesture, so the camera can open
 * inside it — and a fan whose photo was just rejected wants another shot, not
 * another screen asking whether they would like to take one.
 *
 * pickPhoto re-runs the geofence check, which is right: a rejection is a
 * plausible moment for someone to have walked off.
 */
async function tryAgain(): Promise<void> {
  releasePreview()
  capture.value = null
  rejection.value = null
  phase.value = 'framing'
  if (fileInput.value) fileInput.value.value = ''
  await pickPhoto()
}
</script>

<template>
  <section v-if="mission" class="py-5">
    <h1 class="text-lg font-extrabold text-brand-900">{{ resolve(mission.title) }}</h1>
    <!-- Framing instructions only while there is something to frame. The
         normal path now arrives with the photo already taken, and telling
         that fan to "frame the object" describes a step they just finished. -->
    <p v-if="phase === 'framing'" class="mt-1 text-sm text-muted">
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

      <!-- Aim frame: thick rounded corner brackets glowing in the accent,
           pulsing gently while the fan frames the shot (Recipe 17 — the
           pulse is the container's opacity; the glow is a STATIC
           drop-shadow, never an animated box-shadow). The pulse only runs
           in the framing phase; once a photo is in, the frame holds still
           over it. -->
      <div
        class="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_0_6px_var(--color-accent-400)]"
        :class="[isSpyglass ? 'size-40' : 'size-56', phase === 'framing' ? 'viewfinder-pulse' : '']"
        aria-hidden="true"
      >
        <span class="absolute left-0 top-0 size-7 rounded-tl-2xl border-l-4 border-t-4 border-accent-400" />
        <span class="absolute right-0 top-0 size-7 rounded-tr-2xl border-r-4 border-t-4 border-accent-400" />
        <span class="absolute bottom-0 left-0 size-7 rounded-bl-2xl border-b-4 border-l-4 border-accent-400" />
        <span class="absolute bottom-0 right-0 size-7 rounded-br-2xl border-b-4 border-r-4 border-accent-400" />
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

    <!-- The payoff takes over the whole screen (CaptureCelebration), so it
         teleports out of this page rather than rendering below the photo.
         It used to be a card in the flow, which on a 740px phone put the
         biggest moment in the product under the fold and behind the nav. -->
    <CaptureCelebration
      v-if="phase === 'reward'"
      :mission-color="mission.color"
      :just-completed="justCompleted"
      :count="shownCount"
      :target="missionsStore.badgeTarget"
      :stubbed="stubbed"
      @primary="$router.push({ name: justCompleted ? 'redeem' : 'home' })"
      @secondary="$router.push({ name: justCompleted ? 'home' : 'trophies' })"
    />
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
