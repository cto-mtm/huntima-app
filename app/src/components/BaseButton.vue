<script setup lang="ts">
import { computed } from 'vue'
import AppIcon, { type IconName } from './AppIcon.vue'

const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost'
    size?: 'md' | 'lg'
    disabled?: boolean
    type?: 'button' | 'submit'
    /** Leading icon. Sized to the label so it scales with the size prop. */
    icon?: IconName
  }>(),
  { variant: 'primary', size: 'md', disabled: false, type: 'button', icon: undefined },
)

const classes = computed(() => {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-full font-bold transition-[transform,opacity] duration-150 active:scale-[0.96] disabled:opacity-50 disabled:active:scale-100'

  // 44px minimum height on the large size: this is tapped one-handed by
  // someone walking a crowded concourse.
  const sizes = {
    md: 'px-4 py-2 text-sm',
    lg: 'w-full px-6 py-3.5 text-base',
  }

  // Primary gets gradient depth and a colored shadow — a game button, not a
  // form control. Still pure brand tokens, so it re-skins per tenant.
  const variants = {
    primary:
      'bg-gradient-to-b from-brand-500 to-brand-700 text-white shadow-md shadow-brand-600/30',
    secondary: 'bg-brand-50 text-brand-700 border border-brand-200',
    ghost: 'text-brand-700',
  }

  return [base, sizes[props.size], variants[props.variant]].join(' ')
})
</script>

<template>
  <button :type="props.type" :class="classes" :disabled="props.disabled">
    <AppIcon v-if="props.icon" :name="props.icon" class="size-[1.2em] shrink-0" />
    <slot />
  </button>
</template>
