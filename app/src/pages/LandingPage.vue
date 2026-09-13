<script setup lang="ts">
/**
 * The platform front door — deliberately minimal in Phase 1.
 *
 * Nobody is expected to arrive here: a fan's front door is a QR code that
 * deep-links straight into `/:tenantSlug`. This page exists so the bare
 * domain isn't a 404, and as the seam where discovery (Phase 3) will grow.
 * It wears the platform default theme; the router guard deactivates any
 * previously-visited club's brand before this renders.
 */
import { useI18n } from 'vue-i18n'
import LocaleSwitcher from '../components/LocaleSwitcher.vue'

const { t } = useI18n()
</script>

<template>
  <section class="mx-auto flex min-h-dvh max-w-md flex-col px-5 py-10">
    <div class="flex justify-end">
      <LocaleSwitcher variant="expanded" />
    </div>

    <div class="flex flex-1 flex-col items-center justify-center text-center">
      <h1 class="text-4xl font-extrabold tracking-tight text-brand-900" translate="no">
        {{ t('landing.title') }}
      </h1>
      <div
        class="mt-2 h-1.5 w-20 -skew-x-12 rounded-full bg-gradient-to-r from-accent-400 to-accent-600"
        aria-hidden="true"
      />
      <p class="mt-4 text-base text-muted">{{ t('landing.tagline') }}</p>

      <p class="mt-10 rounded-card bg-surface px-5 py-4 text-sm text-brand-900 shadow-sm ring-1 ring-brand-100">
        {{ t('landing.hint') }}
      </p>
    </div>

    <footer class="pt-10 text-center">
      <RouterLink
        :to="{ name: 'staff-login' }"
        class="text-xs text-muted underline-offset-4 hover:underline"
      >
        {{ t('landing.organizerCta') }}
      </RouterLink>
    </footer>
  </section>
</template>
