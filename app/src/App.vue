<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AppShell from './components/AppShell.vue'
import { useMissionsStore } from './stores/missions'
import { useTenantStore } from './stores/tenant'
import { IS_LOCAL_API } from './lib/api'

const route = useRoute()
const missions = useMissionsStore()

// Instantiated here so the brand custom properties are written to <html>
// before the first paint — a flash of the default palette is exactly what a
// white-label product cannot afford.
useTenantStore()

const isAdmin = computed(() => route.meta.admin === true)

// ── Dev tooling ────────────────────────────────────────────────────
// `import.meta.env.DEV` is replaced with the literal `false` in a production
// build, so Rollup drops this branch AND the dynamic import with it — the
// switcher is eliminated, not merely hidden. IS_LOCAL_API additionally keeps
// it away from a dev build that has been pointed at a deployed API.
const DevUserSwitcher = import.meta.env.DEV
  ? defineAsyncComponent(() => import('./dev/DevUserSwitcher.vue'))
  : null
const showDevTools = import.meta.env.DEV && IS_LOCAL_API

// One campaign fetch for the whole session. It degrades to the baked-in
// fallback campaign, so nothing here needs to handle failure.
onMounted(() => {
  void missions.load()
})
</script>

<template>
  <div v-if="isAdmin" class="mx-auto min-h-dvh max-w-5xl bg-canvas px-4">
    <RouterView />
  </div>

  <AppShell v-else>
    <RouterView />
  </AppShell>

  <component :is="DevUserSwitcher" v-if="showDevTools && DevUserSwitcher" />
</template>
