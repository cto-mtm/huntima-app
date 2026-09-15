<script setup lang="ts">
/**
 * A short "how this works" tutorial for fans.
 *
 * This replaced an API health check that used to live here — that is a staff
 * diagnostic and now sits on the admin dashboard (AdminDiagnostics.vue). A fan
 * opening "About" wants to know how to play, not whether GET /health is green.
 *
 * ── It has to look like the same app ─────────────────────────
 * It did not. Every other fan page leads with the display face over a skewed
 * accent rule; this one led with plain bold text, numbered its steps in flat
 * brand-600 discs, and sat its cards on a lighter shadow than anything else in
 * the product. Read on its own it was fine; read one tab away from the hub it
 * looked like a different application's help page.
 *
 * The step numerals are reward medallions on purpose. This is the screen that
 * explains badges, so it is the right place for the badge to be the visual
 * vocabulary rather than a generic numbered list.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AppIcon from '../components/AppIcon.vue'
import RewardMedallion from '../components/reward/RewardMedallion.vue'
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
  <section class="py-5" style="view-transition-name: about-page">
    <!-- Same opening as every other fan page: display face, then the skewed
         accent rule. That pairing is what makes a screen read as part of this
         product rather than as a document inside it. -->
    <h1 class="display-title display-title--sm text-3xl">{{ t('about.title') }}</h1>
    <div
      class="mt-1.5 h-1.5 w-16 -skew-x-12 rounded-full bg-gradient-to-r from-accent-400 to-accent-alt-500"
      aria-hidden="true"
    />

    <p class="mt-3 text-sm text-muted">{{ t('about.intro') }}</p>

    <ol class="mt-6 grid gap-2.5">
      <li
        v-for="(step, index) in steps"
        :key="index"
        class="flex gap-3 rounded-card bg-surface p-4 shadow-md shadow-brand-900/5 ring-1 ring-brand-100"
      >
        <!-- The numeral rides a medallion, not a plain disc: this is the page
             that explains what a badge is, so the badge is the right shape to
             count with. -->
        <RewardMedallion shape="rosette" tier="gold" class="size-10">
          <span class="text-sm font-black text-white">{{ index + 1 }}</span>
        </RewardMedallion>
        <div class="min-w-0 flex-1">
          <h2 class="font-bold leading-tight text-brand-900">{{ step.title }}</h2>
          <p class="mt-1 text-sm leading-snug text-muted">{{ step.body }}</p>
        </div>
      </li>
    </ol>

    <!-- What is true of THIS hunt, run by THIS club. The platform's own
         promises — how photos are handled, what happens to your badges —
         moved to Profile: they are identical at every venue, and a club's
         page should not look like it is the one making them. The link below
         points at them rather than repeating them, because legal copy kept
         in two places drifts. -->
    <section class="mt-8 rounded-card bg-surface p-4 shadow-md shadow-brand-900/5 ring-1 ring-brand-100">
      <h2 class="font-bold text-brand-900">{{ t('about.finePrintTitle') }}</h2>
      <p class="mt-1 text-sm leading-snug text-muted">
        {{ t('about.finePrintBody', { team: tenant.settings.teamName }) }}
      </p>
    </section>

    <!-- A deliberate, labelled exit to platform level. It flips the theme,
         which is exactly why it is a link and not a nav tab. -->
    <RouterLink
      :to="{ name: 'profile' }"
      class="mt-3 flex items-center justify-between gap-3 rounded-card bg-surface p-4 shadow-md shadow-brand-900/5 ring-1 ring-brand-100"
    >
      <span class="min-w-0">
        <span class="block font-bold text-brand-900">{{ t('about.privacyLinkTitle') }}</span>
        <span class="mt-0.5 block text-sm leading-snug text-muted">
          {{ t('about.privacyLinkBody') }}
        </span>
      </span>
      <AppIcon name="chevronRight" class="size-5 shrink-0 text-muted" />
    </RouterLink>

    <div class="mt-8 flex flex-col items-center gap-3">
      <RouterLink :to="{ name: 'entry' }" class="text-sm font-semibold text-brand-600">
        {{ t('about.switchUser') }}
      </RouterLink>
      <RouterLink :to="{ name: 'signin', query: { to: '/orgs' } }" class="text-xs font-semibold text-muted">
        {{ t('common.staffSignIn') }}
      </RouterLink>
    </div>
  </section>
</template>
