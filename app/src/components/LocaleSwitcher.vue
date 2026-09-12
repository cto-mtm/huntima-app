<script setup lang="ts">
/**
 * Two shapes for the same control.
 *
 * `compact` — a cycle button, for the fan shell header where space is scarce
 *   and the language has usually already been chosen.
 * `expanded` — every language named in its own words, for the screens that
 *   come BEFORE a session exists. A family arriving at the entry screen must
 *   be able to switch before they read anything, and a two-letter code is not
 *   something you can find if you cannot read the page it sits on.
 */
import { useI18n } from 'vue-i18n'
import { LOCALE_LABELS, SUPPORTED_LOCALES, setLocale, type SupportedLocale } from '../i18n'

withDefaults(defineProps<{ variant?: 'compact' | 'expanded' }>(), { variant: 'compact' })

const { t, locale } = useI18n()

function cycle(): void {
  const current = SUPPORTED_LOCALES.indexOf(locale.value as SupportedLocale)
  setLocale(SUPPORTED_LOCALES[(current + 1) % SUPPORTED_LOCALES.length])
}
</script>

<template>
  <div
    v-if="variant === 'expanded'"
    class="flex items-center gap-1 rounded-full border border-brand-200 p-0.5"
    role="group"
    :aria-label="t('shell.localeLabel')"
  >
    <button
      v-for="code in SUPPORTED_LOCALES"
      :key="code"
      type="button"
      class="rounded-full px-3 py-1 text-xs font-semibold"
      :class="code === locale ? 'bg-brand-600 text-white' : 'text-brand-700'"
      :aria-pressed="code === locale"
      translate="no"
      @click="setLocale(code)"
    >
      {{ LOCALE_LABELS[code] }}
    </button>
  </div>

  <button
    v-else
    type="button"
    class="rounded-full border border-brand-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-700"
    :aria-label="t('shell.localeLabel')"
    @click="cycle"
  >
    {{ locale }}
  </button>
</template>
