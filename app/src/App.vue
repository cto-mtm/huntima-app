<script setup lang="ts">
import { onMounted } from 'vue'
import AppShell from './components/AppShell.vue'
import { useMissionsStore } from './stores/missions'

const missions = useMissionsStore()

// One campaign fetch for the whole session. It degrades to the baked-in
// fallback campaign, so nothing here needs to handle failure.
onMounted(() => {
  void missions.load()
})
</script>

<template>
  <AppShell>
    <RouterView />
  </AppShell>
</template>
