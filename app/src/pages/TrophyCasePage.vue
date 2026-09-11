<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import BaseButton from '../components/BaseButton.vue'
import MissionCard from '../components/MissionCard.vue'
import TrophyCase from '../components/TrophyCase.vue'
import { useMissionsStore } from '../stores/missions'
import { useProgressStore } from '../stores/progress'

const { t } = useI18n()
const missionsStore = useMissionsStore()
const progress = useProgressStore()
</script>

<template>
  <section class="py-5">
    <TrophyCase />

    <h2 class="mt-6 text-lg font-extrabold text-brand-900">{{ t('hub.title') }}</h2>

    <div class="mt-3 grid gap-2.5">
      <MissionCard
        v-for="mission in missionsStore.missions"
        :key="mission.id"
        :mission="mission"
      />
    </div>

    <div v-if="progress.isComplete" class="mt-6">
      <BaseButton size="lg" @click="$router.push({ name: 'redeem' })">
        {{ t('trophyCase.complete') }}
      </BaseButton>
    </div>
  </section>
</template>
