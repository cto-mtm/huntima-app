<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AppShell from './components/AppShell.vue'
import { useMissionsStore } from './stores/missions'
import { useTenantStore } from './stores/tenant'

const route = useRoute()
const missions = useMissionsStore()

// Instantiated here so the brand custom properties are written to <html>
// before the first paint — a flash of the default palette is exactly what a
// white-label product cannot afford.
const tenant = useTenantStore()

// Screens that exist outside a fan session (entry, staff login, admin)
// render without the fan shell.
const isBare = computed(() => route.meta.bare === true)


// One campaign fetch for the whole session. It degrades to the baked-in
// fallback campaign, so nothing here needs to handle failure.
onMounted(() => {
  void missions.load()
  // Branding is served by the API so every device shows the same club.
  // The cached brand is already painted; this reconciles it.
  void tenant.load()
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
