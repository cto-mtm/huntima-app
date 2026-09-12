<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import BaseButton from '../components/BaseButton.vue'
import { useMissionsStore } from '../stores/missions'
import { useMissionText } from '../lib/missionText'
import { useProgressStore } from '../stores/progress'

const { t } = useI18n()
const { resolve } = useMissionText()
const route = useRoute()
const missionsStore = useMissionsStore()
const progress = useProgressStore()

const missionId = computed(() => String(route.params.id))
const mission = computed(() => missionsStore.byId(missionId.value))
const earned = computed(() => progress.hasBadge(missionId.value))
</script>

<template>
  <section v-if="mission" class="py-5">
    <!-- ══ HERO TARGET ══════════════════════════════════════════
         Same view-transition-name as the small block in MissionCard.vue,
         derived from the same mission id. That pairing is the entire
         mechanism — the browser morphs the 64px card square into this
         full-width header on its own. See docs/animations.md § 1. -->
    <div
      class="relative flex h-44 items-end overflow-hidden rounded-card p-4"
      :style="{ backgroundColor: mission.color, viewTransitionName: `mission-${mission.id}` }"
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
    </div>

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

    <div class="mt-5">
      <BaseButton
        v-if="!earned"
        size="lg"
        @click="$router.push({ name: 'mission-capture', params: { id: mission.id } })"
      >
        {{ t('mission.startCapture') }}
      </BaseButton>
      <BaseButton v-else size="lg" variant="secondary" @click="$router.push({ name: 'home' })">
        {{ t('mission.backToMissions') }}
      </BaseButton>
    </div>
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
