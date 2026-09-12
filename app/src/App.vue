<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AppShell from './components/AppShell.vue'
import { useMissionsStore } from './stores/missions'
import { useTenantStore } from './stores/tenant'
import { useSessionStore } from './stores/session'

const route = useRoute()
const missions = useMissionsStore()

// Instantiated here so the brand custom properties are written to <html>
// before the first paint — a flash of the default palette is exactly what a
// white-label product cannot afford.
const tenant = useTenantStore()
const session = useSessionStore()

// Screens that exist outside a fan session (entry, staff login, admin)
// render without the fan shell.
const isBare = computed(() => route.meta.bare === true)


// One campaign fetch for the whole session. The hub reflects the real
// backend: on success it shows the published hunt or an empty state, and on
// failure the store surfaces a load error (no baked-in fallback).
onMounted(() => {
  void missions.load()
  // Branding is served by the API so every device shows the same club.
  // The cached brand is already painted; this reconciles it.
  void tenant.load()

  // Only if an account has been used on this device. A guest never loads
  // the Auth SDK; a returning fan gets their session back.
  if (session.hasUsedAccount()) void session.ensureAuthReady()
})
</script>

<template>
  <div v-if="isBare" class="mx-auto min-h-dvh max-w-5xl bg-canvas px-4">
    <RouterView />
  </div>

  <AppShell v-else>
    <RouterView />
  </AppShell>
</template>
