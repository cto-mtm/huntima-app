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

export type IconName =
  | 'home'
  | 'missions'
  | 'trophies'
  | 'prize'
  | 'about'
  | 'profile'
  | 'badge'
  | 'search'
  | 'camera'
  | 'spark'
  | 'chevronDown'
  | 'chevronRight'
  | 'lock'
  | 'close'
  | 'star'
  | 'calendar'
  | 'map'
  | 'list'

const props = withDefaults(defineProps<{ name: IconName; title?: string }>(), { title: undefined })

const PATHS: Record<IconName, string[]> = {
  // House — the platform home
  home: ['M4 11.5 12 4l8 7.5', 'M6 10.5V20h12v-9.5', 'M10 20v-5h4v5'],
  // Crosshair — "go find this"
  missions: ['M12 3v3M12 18v3M3 12h3M18 12h3', 'M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z'],
  trophies: [
    'M7 4h10v5a5 5 0 0 1-10 0V4Z',
    'M7 6H4.5v1A3.5 3.5 0 0 0 8 10.5M17 6h2.5v1A3.5 3.5 0 0 1 16 10.5',
    'M12 14v3M9 20h6',
  ],
  prize: ['M3 11h18v9H3v-9Z', 'M3 7.5h18V11H3V7.5Z', 'M12 7.5V20', 'M12 7.5C10 7.5 7.5 7 7.5 5.2 7.5 4 8.4 3.2 9.6 3.2c1.9 0 2.4 2.4 2.4 4.3ZM12 7.5c2 0 4.5-.5 4.5-2.3 0-1.2-.9-2-2.1-2-1.9 0-2.4 2.4-2.4 4.3Z'],
  about: ['M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Z', 'M12 11v5.5', 'M12 7.8v.01'],
  // Head-and-shoulders — the fan's own profile
  profile: ['M12 4a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z', 'M5 20v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1'],
  // Rosette — an earned badge
  badge: ['M12 3.5 14.2 8l5 .7-3.6 3.5.9 5-4.5-2.4L7.5 17.2l.9-5L4.8 8.7l5-.7L12 3.5Z'],
  search: ['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z', 'M16.2 16.2 20.5 20.5'],
  camera: ['M4 8h3l1.5-2h7L17 8h3v11H4V8Z', 'M12 10.5a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4Z'],
  // Four-point star — the "something exciting is happening" accent
  spark: ['M12 3.5l1.7 5.3 5.3 1.7-5.3 1.7L12 17.5l-1.7-5.3L5 10.5l5.3-1.7L12 3.5Z'],
  // Caret — a control that opens a choice (the console's org switcher)
  chevronDown: ['m6 9.5 6 5.5 6-5.5'],
  // Caret — drills INTO something (a level, a series, a leaderboard row)
  chevronRight: ['m9.5 6 5.5 6-5.5 6'],
  // Padlock — a reward that exists but is not yours yet
  lock: ['M7 10.5h10V20H7v-9.5Z', 'M9 10.5V8a3 3 0 0 1 6 0v2.5'],
  // Cross — dismiss a sheet. The only icon that ever closes something.
  close: ['M6.5 6.5l11 11', 'M17.5 6.5l-11 11'],
  // Five-point star — a rating/level marker. NOT `spark`, which is four-point
  // and means "something is happening"; this one means "how much".
  star: ['M12 3.8l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.6 9.9l5.8-.8L12 3.8Z'],
  // Calendar — a dated entry on the journey timeline
  calendar: ['M4 6.5h16V20H4V6.5Z', 'M4 10.5h16', 'M8.5 4v3M15.5 4v3'],
  // Folded map — the venue view toggle
  map: ['M9 5 3.5 7v12L9 17l6 2 5.5-2V5L15 7 9 5Z', 'M9 5v12M15 7v12'],
  // Stacked rows — the list view toggle
  list: ['M4 7h16M4 12h16M4 17h16'],
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
