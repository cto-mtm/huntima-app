<script setup lang="ts">
/**
 * The Huntima mark — a map drop with a camera aperture in it.
 *
 * Inline SVG, not an <img>. The file this replaced was a 595 KB base64 PNG
 * wearing an .svg extension, fetched twice on every screen (header and nav
 * tab) and resampled at 28 px. As real path data it is under 2 KB, inlines
 * into the bundle, and stays crisp on a 3x display.
 *
 * This is the ONE mark in the app whose colors are fixed. Everything else
 * re-skins per tenant; the platform's own identity does not, for the same
 * reason the display face does not — see docs/branding.md. Do not wire these
 * hexes to brand tokens.
 *
 * Decorative by default. Pass `title` when it is the only thing naming a
 * control.
 */
import { useId } from 'vue'

withDefaults(defineProps<{ title?: string }>(), { title: undefined })

// The drop's gradient is referenced by id, so it must be unique per instance —
// the mark renders in the header and the nav bar at the same time.
const uid = useId()
</script>

<template>
  <svg
    viewBox="0 0 64 64"
    :aria-hidden="title ? undefined : 'true'"
    :role="title ? 'img' : undefined"
  >
    <title v-if="title">{{ title }}</title>
    <defs>
      <linearGradient :id="`hm-${uid}`" x1="0" y1="0" x2="0.65" y2="1">
        <stop offset="0%" stop-color="#ff9a3d" />
        <stop offset="52%" stop-color="#f7128f" />
        <stop offset="100%" stop-color="#7c1fd4" />
      </linearGradient>
    </defs>

    <!-- The drop -->
    <path
      d="M32 2C20.4 2 11 11.4 11 23c0 15.3 21 39 21 39s21-23.7 21-39C53 11.4 43.6 2 32 2Z"
      :fill="`url(#hm-${uid})`"
    />
    <!-- The lens barrel: a dark well so the prism blades read against the
         drop's own gradient rather than blending into it. -->
    <circle cx="32" cy="23" r="13.6" fill="#2a1046" />
    <g>
      <path d="M32.00 19.60 L32.00 11.20 A11.8 11.8 0 0 1 42.22 17.10 Z" fill="#ff9a3d" />
        <path d="M34.94 21.30 L42.22 17.10 A11.8 11.8 0 0 1 42.22 28.90 Z" fill="#f7c31e" />
        <path d="M34.94 24.70 L42.22 28.90 A11.8 11.8 0 0 1 32.00 34.80 Z" fill="#2fd699" />
        <path d="M32.00 26.40 L32.00 34.80 A11.8 11.8 0 0 1 21.78 28.90 Z" fill="#3d8bff" />
        <path d="M29.06 24.70 L21.78 28.90 A11.8 11.8 0 0 1 21.78 17.10 Z" fill="#b026ff" />
        <path d="M29.06 21.30 L21.78 17.10 A11.8 11.8 0 0 1 32.00 11.20 Z" fill="#f7128f" />
    </g>
    <circle cx="32" cy="23" r="3.1" fill="#2a1046" />
  </svg>
</template>
