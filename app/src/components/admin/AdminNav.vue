<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useSessionStore } from '../../stores/session'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const session = useSessionStore()

const TABS = [
  { name: 'admin-branding', labelKey: 'hunts.navBranding' },
  { name: 'admin-hunts', labelKey: 'hunts.navHunts' },
] as const

function isActive(name: string): boolean {
  // The hunt editor is a child of Hunts, so it keeps that tab lit.
  return name === 'admin-hunts'
    ? String(route.name ?? '').startsWith('admin-hunt')
    : route.name === name
}

async function signOut(): Promise<void> {
  await session.signOutAll()
  void router.push({ name: 'entry' })
}
</script>

<template>
  <header class="flex flex-wrap items-center justify-between gap-3 border-b border-brand-100 py-3">
    <nav class="flex gap-1">
      <RouterLink
        v-for="tab in TABS"
        :key="tab.name"
        :to="{ name: tab.name }"
        class="rounded-full px-3 py-1.5 text-sm font-semibold"
        :class="isActive(tab.name) ? 'bg-brand-600 text-white' : 'text-brand-700 hover:bg-brand-50'"
      >
        {{ t(tab.labelKey) }}
      </RouterLink>
    </nav>

    <div class="text-right">
      <p v-if="session.adminEmail" class="text-xs text-muted">
        {{ t('entry.signedInAs', { email: session.adminEmail }) }}
      </p>
      <button type="button" class="text-sm font-semibold text-brand-600" @click="signOut">
        {{ t('entry.signOut') }}
      </button>
    </div>
  </header>
</template>
