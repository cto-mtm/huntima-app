<script setup lang="ts">
/**
 * The trophy shelf: hunts the fan has WON, newest first.
 *
 * A trophy is a finished hunt, not one of the current hunt's badges — that
 * badge progress lives on the hub. Keeping the two distinct is the whole point
 * of this rewrite: this page is a record of past wins, the hub is today's game.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import BaseButton from '../components/BaseButton.vue'
import { useProgressStore } from '../stores/progress'
import { useSessionStore } from '../stores/session'
import { useTenantStore } from '../stores/tenant'

const { t, d } = useI18n()
const route = useRoute()
const router = useRouter()
const progress = useProgressStore()
const session = useSessionStore()
const tenant = useTenantStore()

/**
 * This page is GLOBAL, but the redeem CTA targets a tenant route — a prize
 * is collected at a venue. `progress.isComplete` refers to the last loaded
 * hunt, which belongs to the last-visited org, so that slug is the right
 * target; with no slug ever visited there is no hunt to have completed.
 */
const redeemSlug = computed(() => {
  const p = route.params.tenantSlug
  return typeof p === 'string' ? p : tenant.lastSlug
})

function goRedeem(): void {
  if (redeemSlug.value) {
    void router.push({ name: 'redeem', params: { tenantSlug: redeemSlug.value } })
  }
}
</script>

<template>
  <section class="py-5">
    <h1 class="text-2xl font-extrabold text-brand-900">{{ t('trophyCase.earnedHeading') }}</h1>

    <!-- Guests keep progress on this device only. Nudge them to sign in so a
         cleared browser or a new phone doesn't wipe their trophies. -->
    <div
      v-if="session.isGuest"
      class="mt-4 rounded-card bg-brand-50 p-4 ring-1 ring-brand-100"
    >
      <p class="text-sm font-semibold text-brand-900">{{ t('trophyCase.guestPromptTitle') }}</p>
      <p class="mt-1 text-xs text-muted">{{ t('trophyCase.guestPromptBody') }}</p>
      <div class="mt-3">
        <BaseButton size="md" @click="$router.push({ name: 'signin' })">
          {{ t('trophyCase.guestPromptCta') }}
        </BaseButton>
      </div>
    </div>

    <p v-if="!progress.trophies.length" class="mt-3 text-sm text-muted">
      {{ t('trophyCase.empty') }}
    </p>

    <ul v-else class="mt-4 grid gap-2.5">
      <li
        v-for="(trophy, index) in progress.trophies"
        :key="trophy.campaignId"
        class="flex items-center gap-3 rounded-card bg-surface p-3.5 shadow-md shadow-brand-900/5 ring-1 ring-brand-100"
      >
        <div
          class="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 text-white shadow-md shadow-accent-600/30 ring-1 ring-accent-600/20"
          aria-hidden="true"
        >
          <AppIcon name="trophies" class="size-7" />
          <!-- One specular sweep per tile when the case opens (Recipe 10),
               staggered down the shelf. Never loops. -->
          <span
            class="trophy-gleam absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/60 to-transparent"
            :style="{ animationDelay: `${index * 120}ms` }"
          />
        </div>
        <div class="min-w-0 flex-1">
          <h2 class="truncate font-bold text-brand-900" translate="no">{{ trophy.name }}</h2>
          <p class="mt-0.5 text-xs text-muted">
            {{ t('trophyCase.wonOn', { date: d(new Date(trophy.wonAt), 'short') }) }}
          </p>
        </div>
      </li>
    </ul>

    <!-- A win the fan hasn't claimed yet: send them to the prize screen. -->
    <div v-if="progress.isComplete && !progress.redeemed && redeemSlug" class="mt-6">
      <BaseButton size="lg" icon="prize" @click="goRedeem">
        {{ t('trophyCase.complete') }}
      </BaseButton>
    </div>
  </section>
</template>
