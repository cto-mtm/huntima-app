<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import BaseButton from '../components/BaseButton.vue'
import { useTenantStore } from '../stores/tenant'
import { useProgressStore } from '../stores/progress'

const { t } = useI18n()
const progress = useProgressStore()
const tenant = useTenantStore()
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
        {{ t('redeem.wonTitle', { nickname: progress.nickname }) }}
      </h1>
      <p class="mt-2 text-sm text-muted">
        {{ t('redeem.wonBody', { location: tenant.settings.prizeLocation }) }}
      </p>

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
    </template>

    <div class="mt-8">
      <BaseButton variant="secondary" size="lg" @click="$router.push({ name: 'home' })">
        {{ t('redeem.backToMissions') }}
      </BaseButton>
    </div>
  </section>
</template>
