<script setup lang="ts">
/**
 * The club's mark: the uploaded logo, or a monogram of the team name.
 *
 * The fallback is a monogram rather than a placeholder graphic on purpose —
 * a generic image looks broken, whereas initials in the brand color look
 * deliberate right up until the real logo lands.
 */
import { computed } from 'vue'
import { useTenantStore } from '../stores/tenant'

const props = withDefaults(defineProps<{ size?: 'sm' | 'lg' }>(), { size: 'sm' })

const tenant = useTenantStore()

const monogram = computed(() =>
  tenant.settings.teamName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2),
)

const box = computed(() => (props.size === 'lg' ? 'size-16 text-xl' : 'size-7 text-[11px]'))
</script>

<template>
  <img
    v-if="tenant.settings.logoUrl"
    :src="tenant.settings.logoUrl"
    alt=""
    class="shrink-0 rounded-lg object-contain"
    :class="box"
  />
  <span
    v-else
    class="flex shrink-0 items-center justify-center rounded-lg bg-brand-600 font-extrabold text-white"
    :class="box"
    aria-hidden="true"
    translate="no"
  >
    {{ monogram }}
  </span>
</template>
