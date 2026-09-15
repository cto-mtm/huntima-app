<script setup lang="ts">
/**
 * One mission: the clue, the hint, and the camera.
 *
 * ── The camera opens from HERE ────────────────────────────────
 * It used to take two taps to reach a lens: "Open camera" navigated to a
 * capture screen whose own drawn viewfinder was not a camera either, and a
 * second button finally opened the real one. The middle screen existed to
 * host that second tap — because `input.click()` only opens the OS camera
 * inside a user gesture, and a gesture does not survive a route change.
 *
 * So the tap lives on this page now, where it already is a gesture. The photo
 * is handed to the capture route through lib/pendingCapture, which lands
 * straight on "checking…". The clue image is a tap target too: the fan is
 * looking at the thing they have to photograph, so it is the obvious place to
 * press.
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import BaseButton from '../components/BaseButton.vue'
import MissionSkeleton from '../components/MissionSkeleton.vue'
import EmptyState from '../components/EmptyState.vue'
import { useMissionsStore } from '../stores/missions'
import { useMissionText } from '../lib/missionText'
import { useProgressStore } from '../stores/progress'
import { useGeofence } from '../composables/useGeofence'
import { setPendingCapture } from '../lib/pendingCapture'

const { t } = useI18n()
const { resolve } = useMissionText()
const route = useRoute()
const router = useRouter()
const missionsStore = useMissionsStore()
const progress = useProgressStore()
const geofence = useGeofence()

const missionId = computed(() => String(route.params.id))
const mission = computed(() => missionsStore.byId(missionId.value))
const earned = computed(() => progress.hasBadge(missionId.value))

const fileInput = ref<HTMLInputElement | null>(null)
const locating = ref(false)
const rejection = ref<string | null>(null)

async function openCamera(): Promise<void> {
  // If the club set a geofence, check the fan is roughly here before opening
  // the camera. Soft gate — see useGeofence: a denied or fuzzy fix resolves to
  // 'ok', so it only ever stops someone who is clearly somewhere else.
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
function onFileChosen(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  // Reset the input either way: picking the SAME file twice must still fire
  // a change event, which it will not if the value is still set.
  input.value = ''
  if (!file) return

  setPendingCapture(file)
  void router.push({ name: 'mission-capture', params: { id: missionId.value } })
}
</script>

<template>
  <section v-if="mission" class="py-5">
    <!-- ══ HERO TARGET ══════════════════════════════════════════
         Same view-transition-name as the small block in MissionCard.vue,
         derived from the same mission id. That pairing is the entire
         mechanism — the browser morphs the 64px card square into this
         full-width header on its own. See docs/animations.md § 1.

         It is also the shutter. The fan is staring at the thing they have to
         photograph; making that the button is shorter than making them find
         one. A <button> rather than a click handler on a div, so it is
         reachable by keyboard and announced as a control. -->
    <button
      type="button"
      class="relative flex h-44 w-full items-end overflow-hidden rounded-card p-4 text-left transition-transform duration-150 active:scale-[0.99] disabled:active:scale-100"
      :style="{ backgroundColor: mission.color, viewTransitionName: `mission-${mission.id}` }"
      :disabled="earned || locating"
      :aria-label="t('mission.startCapture')"
      @click="openCamera"
    >
      <!-- The target photo is the clue: show it here (and it morphs from the
           list card). Missions without one fall back to the color block and
           lean on the written hint. -->
      <img
        v-if="mission.targetImageUrl"
        :src="mission.targetImageUrl"
        alt=""
        class="absolute inset-0 size-full object-cover"
      />

      <span
        class="relative rounded-full bg-black/25 px-2.5 py-1 text-[11px] font-semibold text-white"
      >
        {{ t(`missionCard.kind.${mission.kind}`) }}
      </span>

      <!-- The shutter affordance, so the image does not merely happen to be
           tappable. Hidden once the badge is won: there is nothing to shoot. -->
      <span
        v-if="!earned"
        class="absolute bottom-3 right-3 flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-accent-400 to-accent-alt-500 text-white shadow-lg shadow-accent-alt-600/40 ring-2 ring-white/80"
        aria-hidden="true"
      >
        <AppIcon name="camera" class="size-6" />
      </span>
    </button>

    <!-- Second half of the pair: the title morphs too. -->
    <h1
      class="mt-4 text-2xl font-extrabold text-brand-900"
      :style="{ viewTransitionName: `mission-title-${mission.id}` }"
    >
      {{ resolve(mission.title) }}
    </h1>

    <p v-if="!mission.targetImageUrl" class="mt-1 text-xs italic text-muted">
      {{ t('mission.targetPhotoMissing') }}
    </p>

    <div class="mt-5 rounded-card bg-surface p-4 shadow-sm ring-1 ring-brand-100">
      <h2 class="text-xs font-bold uppercase tracking-wide text-muted">
        {{ t('mission.hintLabel') }}
      </h2>
      <p class="mt-1 text-base text-brand-900">{{ resolve(mission.hint) }}</p>
    </div>

    <p v-if="earned" class="mt-5 text-center text-sm font-semibold text-accent-600">
      {{ t('mission.alreadyEarned') }}
    </p>

    <!-- The same action as the hero, spelled out. Two ways in on purpose:
         the image is the fast one, the button is the one nobody has to
         discover. -->
    <div class="mt-5">
      <BaseButton
        v-if="!earned"
        size="lg"
        icon="camera"
        :disabled="locating"
        @click="openCamera"
      >
        {{ locating ? t('capture.locating') : t('mission.startCapture') }}
      </BaseButton>
      <BaseButton v-else size="lg" variant="secondary" @click="$router.push({ name: 'home' })">
        {{ t('mission.backToMissions') }}
      </BaseButton>

      <!-- Geofence refusal lands here, next to the control that triggered it. -->
      <p v-if="rejection" class="mt-2 text-center text-sm font-medium text-red-600">
        {{ rejection }}
      </p>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      capture="environment"
      class="sr-only"
      @change="onFileChosen"
    />
  </section>

  <!-- Deep link while /missions is still in flight: a skeleton of this very
       page, not a premature "not found" that pops into content a beat later. -->
  <section
    v-else-if="missionsStore.loading"
    class="py-5"
    role="status"
    :aria-label="t('common.loading')"
  >
    <MissionSkeleton variant="detail" />
  </section>

  <section v-else class="py-6">
    <EmptyState shape="rosette" :title="t('mission.notFoundTitle')" :body="t('mission.notFound')">
      <BaseButton size="lg" variant="secondary" @click="$router.push({ name: 'home' })">
        {{ t('mission.backToMissions') }}
      </BaseButton>
    </EmptyState>
  </section>
</template>
