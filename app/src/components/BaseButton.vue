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
  // Tactile 3D keys: the bottom "edge" is a hard 0-blur shadow, and pressing
  // translates the button down onto it — a physical key you push, not a flat
  // control that dims. Only transform animates (the rules); the shadow swap
  // is an instant state change hidden under the finger.
  const base =
    'inline-flex items-center justify-center gap-2 rounded-full font-bold transition-transform duration-150 disabled:opacity-50 disabled:active:translate-y-0 disabled:active:scale-100'

  // 44px minimum height on the large size: this is tapped one-handed by
  // someone walking a crowded concourse.
  const sizes = {
    md: 'px-4 py-2 text-sm',
    lg: 'w-full px-6 py-3.5 text-base',
  }

  // Primary is the candy CTA: accent→accent-alt gradient (the tenant's one
  // accent pick, hue-rotated — see lib/color.ts), pressed down onto its
  // darker edge. Pure tokens throughout, so it re-skins per tenant.
  const variants = {
    primary:
      'bg-gradient-to-r from-accent-500 to-accent-alt-600 text-white ' +
      'shadow-[0_4px_0_0_var(--color-accent-alt-600)] active:translate-y-[3px] ' +
      'active:shadow-[0_1px_0_0_var(--color-accent-alt-600)]',
    secondary:
      'bg-surface text-brand-700 border border-brand-200 ' +
      'shadow-[0_3px_0_0_var(--color-brand-200)] active:translate-y-[2px] ' +
      'active:shadow-[0_1px_0_0_var(--color-brand-200)]',
    ghost: 'text-brand-700 active:scale-[0.96]',
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
