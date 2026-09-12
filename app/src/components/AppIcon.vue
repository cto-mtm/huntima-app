<script setup lang="ts">
/**
 * The app's icon set.
 *
 * Deliberately not emoji. Emoji render as a different picture on every
 * platform, can't inherit the brand color, and sit at whatever size and
 * baseline the system font decides — which shows immediately when the whole
 * product is meant to re-skin for any club. These are stroked paths on
 * `currentColor`, so they take the palette like everything else.
 *
 * Decorative by default (`aria-hidden`). Pass a `title` only when the icon
 * is the sole content of a control and nothing else names it.
 */
import { computed } from 'vue'

export type IconName = 'missions' | 'trophies' | 'prize' | 'about' | 'badge' | 'search' | 'camera'

const props = withDefaults(defineProps<{ name: IconName; title?: string }>(), { title: undefined })

const PATHS: Record<IconName, string[]> = {
  // Crosshair — "go find this"
  missions: ['M12 3v3M12 18v3M3 12h3M18 12h3', 'M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z'],
  trophies: [
    'M7 4h10v5a5 5 0 0 1-10 0V4Z',
    'M7 6H4.5v1A3.5 3.5 0 0 0 8 10.5M17 6h2.5v1A3.5 3.5 0 0 1 16 10.5',
    'M12 14v3M9 20h6',
  ],
  prize: ['M3 11h18v9H3v-9Z', 'M3 7.5h18V11H3V7.5Z', 'M12 7.5V20', 'M12 7.5C10 7.5 7.5 7 7.5 5.2 7.5 4 8.4 3.2 9.6 3.2c1.9 0 2.4 2.4 2.4 4.3ZM12 7.5c2 0 4.5-.5 4.5-2.3 0-1.2-.9-2-2.1-2-1.9 0-2.4 2.4-2.4 4.3Z'],
  about: ['M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Z', 'M12 11v5.5', 'M12 7.8v.01'],
  // Rosette — an earned badge
  badge: ['M12 3.5 14.2 8l5 .7-3.6 3.5.9 5-4.5-2.4L7.5 17.2l.9-5L4.8 8.7l5-.7L12 3.5Z'],
  search: ['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z', 'M16.2 16.2 20.5 20.5'],
  camera: ['M4 8h3l1.5-2h7L17 8h3v11H4V8Z', 'M12 10.5a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4Z'],
}

const paths = computed(() => PATHS[props.name])
</script>

<template>
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    :aria-hidden="props.title ? undefined : 'true'"
    :role="props.title ? 'img' : undefined"
  >
    <title v-if="props.title">{{ props.title }}</title>
    <path v-for="(d, i) in paths" :key="i" :d="d" />
  </svg>
</template>
