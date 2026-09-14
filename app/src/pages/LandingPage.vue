<script setup lang="ts">
/**
 * The marketing front door — signed-out ONLY (the router guard redirects
 * anyone with a session to /home). A poster, not the app: one hero, one CTA,
 * the QR hint for fans who arrived without a link. It is the single remaining
 * bare consumer page on purpose — a shell full of tabs that all bounce to
 * sign-in would be worse than a clean pitch with one button.
 *
 * Wears the Huntima platform theme (the guard deactivates any club brand
 * before this renders). The locale switcher sits at the BOTTOM: detection is
 * automatic (device language, English fallback), so switching is a
 * correction, not a first task.
 */
import { useI18n } from 'vue-i18n'
import BaseButton from '../components/BaseButton.vue'
import LocaleSwitcher from '../components/LocaleSwitcher.vue'
// The PLATFORM mark — Huntima's own, a build-time asset. Org logos are
// runtime uploads and live in tenant config; the two never mix.
import logoUrl from '../assets/logo.svg'

const { t } = useI18n()
</script>

<template>
  <section class="mx-auto flex min-h-dvh max-w-md flex-col px-5 py-10">
    <div class="flex flex-1 flex-col items-center justify-center text-center">
      <img :src="logoUrl" alt="" class="size-36" aria-hidden="true" />
      <h1 class="display-title mt-2 text-5xl" translate="no">{{ t('landing.title') }}</h1>
      <div
        class="mt-3 h-1.5 w-20 -skew-x-12 rounded-full bg-gradient-to-r from-accent-400 to-accent-alt-500"
        aria-hidden="true"
      />
      <p class="mt-4 text-base text-muted">{{ t('landing.tagline') }}</p>

      <!-- The consumer door: an account is cross-club identity (ongoing
           games, trophies, your hunts) and needs no QR code. Joining a
           specific hunt still goes through that org's page — usually
           scanned, sometimes typed. -->
      <div class="mt-8 w-full max-w-xs">
        <BaseButton size="lg" @click="$router.push({ name: 'signin' })">
          {{ t('landing.signInCta') }}
        </BaseButton>
      </div>

      <p class="mt-4 rounded-card bg-surface px-5 py-4 text-sm text-brand-900 shadow-sm ring-1 ring-brand-100">
        {{ t('landing.hint') }}
      </p>
    </div>

    <footer class="pt-10 text-center">
      <div class="mb-4 flex justify-center">
        <LocaleSwitcher variant="expanded" />
      </div>
      <RouterLink
        :to="{ name: 'staff-login' }"
        class="text-xs text-muted underline-offset-4 hover:underline"
      >
        {{ t('landing.organizerCta') }}
      </RouterLink>
    </footer>
  </section>
</template>
