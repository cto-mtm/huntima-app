<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '../components/BaseButton.vue'
import { useTenantStore } from '../stores/tenant'
import { useProgressStore } from '../stores/progress'
import { useMissionsStore } from '../stores/missions'
import { useFanName } from '../composables/useFanName'

const { t } = useI18n()
const progress = useProgressStore()
const missionsStore = useMissionsStore()
const { displayName } = useFanName()
const tenant = useTenantStore()

// A prize is only worth showing once it has a name — a hunt may not have one
// configured, and the seed fallback never does.
const prize = computed(() => {
  const p = missionsStore.prize
  return p && p.name.trim() ? p : null
})
</script>

<template>
  <section class="py-6">
    <!-- ── Already claimed ───────────────────────────────────────
         SEAM: `redeemed` is only ever set locally today, so nothing
         actually flips it. The staff "Redeem" action on the admin
         dashboard is what should set it, server-side — that is the
         whole anti-double-claim mechanism and it cannot live on the
         fan's device. -->
    <template v-if="progress.redeemed">
      <h1 class="text-2xl font-extrabold text-muted">{{ t('redeem.redeemedTitle') }}</h1>
      <p class="mt-2 text-sm text-muted">{{ t('redeem.redeemedBody') }}</p>
    </template>

    <!-- ── Win state ─────────────────────────────────────────────── -->
    <template v-else-if="progress.isComplete">
      <h1 class="text-2xl font-extrabold text-brand-900">
        {{ t('redeem.wonTitle', { nickname: displayName }) }}
      </h1>
      <p class="mt-2 text-sm text-muted">
        {{ t('redeem.wonBody', { location: tenant.settings.prizeLocation }) }}
      </p>

      <!-- What they won, if the hunt configured a prize. -->
      <div v-if="prize" class="mt-6 overflow-hidden rounded-card bg-surface shadow-sm ring-1 ring-brand-100">
        <img
          v-if="prize.imageUrl"
          :src="prize.imageUrl"
          alt=""
          class="h-40 w-full object-cover"
        />
        <div class="p-5">
          <p class="text-xs font-bold uppercase tracking-wide text-muted">
            {{ t('redeem.prizeHeading') }}
          </p>
          <h2 class="mt-1 text-lg font-extrabold text-brand-900" translate="no">{{ prize.name }}</h2>
          <p v-if="prize.description" class="mt-1 text-sm text-muted" translate="no">
            {{ prize.description }}
          </p>
          <p v-if="prize.winnerLimit > 0" class="mt-2 text-xs font-semibold text-accent-600">
            {{ t('redeem.prizeWinners', { count: prize.winnerLimit }) }}
          </p>
        </div>
      </div>

      <div class="mt-6 rounded-card bg-surface p-6 text-center shadow-sm ring-2 ring-accent-400">
        <p class="text-xs font-bold uppercase tracking-widest text-muted">
          {{ t('redeem.pinLabel') }}
        </p>
        <!-- Deliberately huge: a staff member reads this across a counter
             in a loud, bright concourse. -->
        <!-- An identifier, not prose: never machine-translated. -->
        <p
          class="mt-2 font-mono text-6xl font-black tracking-[0.2em] text-brand-900"
          translate="no"
        >
          {{ progress.claimCode }}
        </p>
      </div>
    </template>

    <!-- ── Locked ────────────────────────────────────────────────── -->
    <template v-else>
      <h1 class="text-2xl font-extrabold text-brand-900">{{ t('redeem.lockedTitle') }}</h1>
      <p class="mt-2 text-sm text-muted">
        {{ t('redeem.lockedBody', { remaining: progress.remaining }) }}
      </p>

      <!-- Show what they're playing for, so the prize is a reason to keep
           going rather than a surprise revealed only at the finish line. -->
      <div
        v-if="prize"
        class="mt-6 overflow-hidden rounded-card bg-surface shadow-sm ring-1 ring-brand-100"
      >
        <img
          v-if="prize.imageUrl"
          :src="prize.imageUrl"
          alt=""
          class="h-40 w-full object-cover"
        />
        <div class="p-5">
          <p class="text-xs font-bold uppercase tracking-wide text-muted">
            {{ t('redeem.prizeUpForGrabs') }}
          </p>
          <h2 class="mt-1 text-lg font-extrabold text-brand-900" translate="no">{{ prize.name }}</h2>
          <p v-if="prize.description" class="mt-1 text-sm text-muted" translate="no">
            {{ prize.description }}
          </p>
          <p v-if="prize.winnerLimit > 0" class="mt-2 text-xs font-semibold text-accent-600">
            {{ t('redeem.prizeWinners', { count: prize.winnerLimit }) }}
          </p>
        </div>
      </div>
    </template>

    <div class="mt-8">
      <BaseButton variant="secondary" size="lg" @click="$router.push({ name: 'home' })">
        {{ t('redeem.backToMissions') }}
      </BaseButton>
    </div>
  </section>
</template>
