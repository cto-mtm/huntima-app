<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useTenantStore } from '../../stores/tenant'
import { useMissionsStore } from '../../stores/missions'
import { useMissionText } from '../../lib/missionText'
import AppIcon from '../AppIcon.vue'
import TeamMark from '../TeamMark.vue'

const { t } = useI18n()
const tenant = useTenantStore()
const missionsStore = useMissionsStore()
const { resolve } = useMissionText()

// A deliberately small slice of the real hub. It renders the SAME utility
// classes as the app (bg-brand-*, text-accent-*), so it re-skins through the
// same CSS custom properties rather than through a parallel mock palette —
// if the preview looks right, the app looks right.
</script>

<template>
  <div class="mx-auto w-full max-w-[320px] overflow-hidden rounded-[2rem] bg-brand-900 p-2 shadow-xl">
    <div class="overflow-hidden rounded-[1.5rem] bg-canvas">
      <!-- header -->
      <div class="flex items-center justify-between border-b border-brand-100 bg-surface px-3 py-2.5">
        <div class="flex items-center gap-1.5">
          <TeamMark />
          <span class="truncate text-xs font-bold text-brand-900">
            {{ tenant.settings.teamName }}
          </span>
        </div>
        <span class="rounded-full border border-brand-200 px-2 py-0.5 text-[9px] font-semibold uppercase text-brand-700">
          en
        </span>
      </div>

      <div class="space-y-2.5 p-3">
        <!-- trophy case -->
        <div class="rounded-xl bg-surface p-2.5 ring-1 ring-brand-100">
          <div class="flex items-baseline justify-between">
            <span class="text-[10px] font-bold uppercase tracking-wide text-brand-900">
              {{ t('trophyCase.title') }}
            </span>
            <span class="text-[10px] text-muted">
              {{ t('trophyCase.progress', { earned: 2, target: 5 }) }}
            </span>
          </div>
          <div class="mt-1.5 flex gap-1">
            <div class="flex aspect-square flex-1 items-center justify-center rounded-md bg-accent-500">
              <AppIcon name="badge" class="size-3 text-white/90" />
            </div>
            <div class="flex aspect-square flex-1 items-center justify-center rounded-md bg-accent-400">
              <AppIcon name="badge" class="size-3 text-white/90" />
            </div>
            <div
              v-for="i in 3"
              :key="i"
              class="aspect-square flex-1 rounded-md border-2 border-dashed border-brand-100"
            />
          </div>
        </div>

        <!-- mission cards -->
        <div
          v-for="mission in missionsStore.missions.slice(0, 2)"
          :key="mission.id"
          class="flex items-center gap-2 rounded-xl bg-surface p-2 ring-1 ring-brand-100"
        >
          <div class="size-9 shrink-0 rounded-lg" :style="{ backgroundColor: mission.color }" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-[11px] font-semibold text-brand-900">
              {{ resolve(mission.title) }}
            </p>
            <p class="text-[9px] text-muted">{{ t(`missionCard.kind.${mission.kind}`) }}</p>
          </div>
          <span class="rounded-full bg-brand-50 px-1.5 py-0.5 text-[8px] font-semibold text-brand-600">
            {{ t('missionCard.statusLocked') }}
          </span>
        </div>

        <!-- primary button: the contrast case that matters most -->
        <button
          type="button"
          class="w-full rounded-full bg-brand-600 px-4 py-2.5 text-xs font-semibold text-white"
        >
          {{ t('mission.startCapture') }}
        </button>
      </div>
    </div>
  </div>
</template>
