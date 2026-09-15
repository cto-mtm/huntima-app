<script setup lang="ts">
/**
 * A one-line "we're working" row: the shared Spinner beside "Loading…". Use
 * this for the many inline waits (an admin list, a diagnostics check) where a
 * full skeleton would be overkill but a bare line of grey text read as dead.
 *
 * The Spinner here is decorative — this row carries its own `role="status"`
 * and the visible, translated label, so a screen reader announces the text
 * once and not the spinner too.
 */
import { useI18n } from 'vue-i18n'
import Spinner from './Spinner.vue'

withDefaults(defineProps<{ label?: string }>(), { label: undefined })

const { t } = useI18n()
</script>

<template>
  <p class="flex items-center gap-2 text-sm text-muted" role="status">
    <Spinner class="size-4 text-accent-600" />
    {{ label ?? t('common.loading') }}
  </p>
</template>
