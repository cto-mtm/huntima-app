<script setup lang="ts">
/**
 * A short "how this works" tutorial for fans.
 *
 * This replaced an API health check that used to live here — that is a staff
 * diagnostic and now sits on the admin dashboard (AdminDiagnostics.vue). A fan
 * opening "About" wants to know how to play, not whether GET /health is green.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTenantStore } from '../stores/tenant'

const { t } = useI18n()
const tenant = useTenantStore()

const steps = computed(() => [
  { title: t('about.step1Title'), body: t('about.step1Body') },
  { title: t('about.step2Title'), body: t('about.step2Body') },
  { title: t('about.step3Title'), body: t('about.step3Body') },
  { title: t('about.step4Title'), body: t('about.step4Body') },
  { title: t('about.step5Title'), body: t('about.step5Body', { location: tenant.settings.prizeLocation }) },
])
</script>

<template>
  <!-- The custom per-page transition from docs/animations.md § 2 lives on
       this element. The name is static, which is only safe because a page
       root renders exactly once. See Recipe 6 in transitions.css. -->
  <section class="py-6" style="view-transition-name: about-page">
    <h1 class="text-2xl font-extrabold text-brand-900">{{ t('about.title') }}</h1>
    <p class="mt-2 text-sm text-muted">{{ t('about.intro') }}</p>

    <ol class="mt-6 grid gap-3">
      <li
        v-for="(step, index) in steps"
        :key="index"
        class="flex gap-3 rounded-card bg-surface p-4 shadow-sm ring-1 ring-brand-100"
      >
        <span
          class="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white"
          aria-hidden="true"
        >
          {{ index + 1 }}
        </span>
        <div class="min-w-0">
          <h2 class="font-bold text-brand-900">{{ step.title }}</h2>
          <p class="mt-0.5 text-sm text-muted">{{ step.body }}</p>
        </div>
      </li>
    </ol>

    <div class="mt-8 flex flex-col items-center gap-3">
      <RouterLink :to="{ name: 'entry' }" class="text-sm font-semibold text-brand-600">
        {{ t('entry.switchUser') }}
      </RouterLink>
      <RouterLink :to="{ name: 'staff-login' }" class="text-xs font-semibold text-muted">
        {{ t('entry.staffSignIn') }}
      </RouterLink>
    </div>
  </section>
</template>
