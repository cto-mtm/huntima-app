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
useTenantStore()

const isAdmin = computed(() => route.meta.admin === true)

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
</template>
