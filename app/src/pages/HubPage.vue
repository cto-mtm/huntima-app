<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import MissionCard from '../components/MissionCard.vue'
import TrophyCase from '../components/TrophyCase.vue'
import { useMissionsStore } from '../stores/missions'
import { useFanName } from '../composables/useFanName'

const { t } = useI18n()
const missionsStore = useMissionsStore()
const { displayName } = useFanName()
</script>

<template>
  <section class="py-5">
    <p class="text-sm text-muted">{{ t('hub.greeting', { nickname: displayName }) }}</p>

    <TrophyCase class="mt-3" />

    <p
      v-if="missionsStore.usingFallback && !missionsStore.loading"
      class="mt-3 rounded-lg bg-accent-500/10 px-3 py-2 text-xs font-medium text-accent-600"
    >
      {{ t('common.offline') }}
    </p>

    <div class="mt-6 flex items-center justify-between">
      <h1 class="text-lg font-extrabold text-brand-900">{{ t('hub.title') }}</h1>
      <button
        type="button"
        class="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700"
        :title="t('hub.shuffleHint')"
        @click="missionsStore.shuffle()"
      >
        {{ t('hub.shuffle') }}
      </button>
    </div>

    <p v-if="!missionsStore.missions.length" class="mt-4 text-sm text-muted">
      {{ t('hub.empty') }}
    </p>

    <!-- Recipe 4 (docs/animations.md): TransitionGroup gives the FLIP
         glide when shuffle() reorders the array. `relative` is required
         because .list-leave-active takes leaving items out of flow with
         position: absolute. The :key MUST be the stable mission id — an
         index key defeats the whole mechanism. -->
    <TransitionGroup v-else name="list" tag="div" class="relative mt-3 grid gap-2.5">
      <MissionCard v-for="mission in missionsStore.missions" :key="mission.id" :mission="mission" />
    </TransitionGroup>
  </section>
</template>
