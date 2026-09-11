<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost'
    size?: 'md' | 'lg'
    disabled?: boolean
    type?: 'button' | 'submit'
  }>(),
  { variant: 'primary', size: 'md', disabled: false, type: 'button' },
)

const classes = computed(() => {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[transform,opacity] duration-150 active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100'

  // 44px minimum height on the large size: this is tapped one-handed by
  // someone walking a crowded concourse.
  const sizes = {
    md: 'px-4 py-2 text-sm',
    lg: 'w-full px-6 py-3.5 text-base',
  }

  const variants = {
    primary: 'bg-brand-600 text-white',
    secondary: 'bg-brand-50 text-brand-700 border border-brand-200',
    ghost: 'text-brand-700',
  }

  return [base, sizes[props.size], variants[props.variant]].join(' ')
})
</script>

<template>
  <button :type="props.type" :class="classes" :disabled="props.disabled">
    <slot />
  </button>
</template>
