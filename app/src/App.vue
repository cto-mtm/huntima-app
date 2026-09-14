<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import AppShell from './components/AppShell.vue'
import ConsoleShell from './components/ConsoleShell.vue'
import BareLayout from './components/BareLayout.vue'
import PageCover from './components/PageCover.vue'
import { useTenantStore } from './stores/tenant'
import { useSessionStore } from './stores/session'
import { useProgressStore } from './stores/progress'

const { t } = useI18n()
const route = useRoute()

// Instantiated here so the theme custom properties are written to <html>
// before the first paint — a flash of the wrong palette is exactly what a
// white-label product cannot afford. Which org's brand (or the platform
// default) is applied is driven by the router guard: `activate(slug)` on
// tenant routes, `deactivate()` on platform routes. The missions store is
// activated by the same guard, so no data loading happens here anymore.
const tenant = useTenantStore()
const session = useSessionStore()

// Instantiated on boot so its account-sync watcher is live on every entry
// path: a returning signed-in fan is hydrated the moment auth resolves, not
// only once they navigate to a page that happens to read progress. A no-op
// for guests and admins — the watcher gates on the fan role.
useProgressStore()

// Which chrome wraps the page. Declared per-route in meta.layout; absent means
// the two-level fan AppShell (the default). 'console' is the org console,
// 'bare' the out-of-app surfaces. This is the ONE place layouts are chosen.
const layout = computed(() => route.meta.layout ?? 'app')

// The API said this slug does not exist: show "no team here" instead of a
// phantom default club wearing the platform palette. Network failures never
// set `notFound`, so an offline fan keeps their cached app.
const tenantMissing = computed(
  () => tenant.notFound && typeof route.params.tenantSlug === 'string',
)

onMounted(() => {
  // Only if an account has been used on this device. A guest never loads
  // the Auth SDK; a returning fan gets their session back.
  if (session.hasUsedAccount()) void session.ensureAuthReady()
})
</script>

<template>
  <!-- Full-screen navigation cover. Rendered at the very top so it sits above
       both shells and the ambient backdrop, masking the backdrop's view-
       transition snapshot during every navigation. Toggled by the router. -->
  <PageCover />

  <section
    v-if="tenantMissing"
    class="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-5 text-center"
  >
    <h1 class="text-2xl font-extrabold text-brand-900">{{ t('notFound.tenantTitle') }}</h1>
    <p class="mt-2 text-sm text-muted">{{ t('notFound.tenantBody') }}</p>
    <RouterLink
      to="/"
      class="mt-6 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white"
    >
      {{ t('notFound.home') }}
    </RouterLink>
  </section>

  <ConsoleShell v-else-if="layout === 'console'">
    <RouterView />
  </ConsoleShell>

  <BareLayout v-else-if="layout === 'bare'">
    <RouterView />
  </BareLayout>

  <AppShell v-else>
    <RouterView />
  </AppShell>
</template>
