<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { SUPPORTED_LOCALES, setLocale, type SupportedLocale } from '../i18n'

const { t, locale } = useI18n()

function cycle(): void {
  const current = SUPPORTED_LOCALES.indexOf(locale.value as SupportedLocale)
  const next = SUPPORTED_LOCALES[(current + 1) % SUPPORTED_LOCALES.length]
  setLocale(next)
}
</script>

<template>
  <button
    type="button"
    class="rounded-full border border-brand-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-700"
    :aria-label="t('shell.localeLabel')"
    @click="cycle"
  >
    {{ locale }}
  </button>
</template>
