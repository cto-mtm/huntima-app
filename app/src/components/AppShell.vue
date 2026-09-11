<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import LocaleSwitcher from './LocaleSwitcher.vue'
import { tenant } from '../config/tenant'
import { useProgressStore } from '../stores/progress'

const { t } = useI18n()
const route = useRoute()
const progress = useProgressStore()

// Order matters: this is thumb-reach order on a phone, most-used first.
const NAV = [
  { name: 'home', labelKey: 'shell.navMissions', icon: '🎯' },
  { name: 'trophies', labelKey: 'shell.navTrophies', icon: '🏆' },
  { name: 'redeem', labelKey: 'shell.navPrize', icon: '🎁' },
  { name: 'about', labelKey: 'shell.navAbout', icon: 'ℹ️' },
] as const

// RouterLink's own active-class can't be used for the "home" tab: its path
// is "/", which prefix-matches every route, so every tab would light up.
// The mission and capture screens belong under Missions, hence the prefix.
function isActive(name: string): boolean {
  const current = String(route.name ?? '')
  if (name === 'home') return current === 'home' || current.startsWith('mission')
  return current === name
}
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-canvas">
    <!-- Header. pt-safe + px-safe keep it clear of the notch and of
         landscape rounded corners; the same markup is correct in a
         browser tab, where the env() values resolve to 0. -->
    <header
      class="fixed inset-x-0 top-0 z-20 border-b border-brand-100 bg-surface/90 pt-safe px-safe backdrop-blur"
    >
      <div class="flex h-14 items-center justify-between px-4">
        <RouterLink :to="{ name: 'home' }" class="flex items-center gap-2">
          <span aria-hidden="true" class="text-xl">{{ progress.avatar }}</span>
          <span class="text-sm font-bold text-brand-900">{{ tenant.teamName }}</span>
        </RouterLink>
        <LocaleSwitcher />
      </div>
    </header>

    <!-- The single scrolling region. Bottom padding clears the nav bar
         plus the home indicator. -->
    <main class="flex-1 px-4 px-safe pb-28 mt-header-safe">
      <slot />
    </main>

    <nav
      class="fixed inset-x-0 bottom-0 z-20 border-t border-brand-100 bg-surface/95 pb-safe px-safe backdrop-blur"
    >
      <ul class="flex items-stretch justify-around">
        <li v-for="item in NAV" :key="item.name" class="flex-1">
          <RouterLink
            :to="{ name: item.name }"
            class="flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium"
            :class="isActive(item.name) ? 'text-brand-600' : 'text-muted'"
            :aria-current="isActive(item.name) ? 'page' : undefined"
          >
            <span aria-hidden="true" class="text-lg leading-none">{{ item.icon }}</span>
            {{ t(item.labelKey) }}
          </RouterLink>
        </li>
      </ul>
    </nav>
  </div>
</template>
