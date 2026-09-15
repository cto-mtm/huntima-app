<script setup lang="ts">
/**
 * The reward chest — the payoff object.
 *
 * In the mockups this is a "daily bonus" that hands out points. It is NOT
 * wired to anything like that here, and deliberately: a chest that grants a
 * reward on a timer needs a server that issues rewards, and this app's server
 * does not own the badge ledger yet (see docs/architecture.md § Seams left
 * open). A client-side chest is just a button that lies.
 *
 * So it lives where a real, server-verified event already happens: the moment
 * a capture comes back verified. Same object, same payoff feeling, backed by
 * something that actually occurred.
 *
 * ── Blend ─────────────────────────────────────────────────────
 * The chest body is the tenant's accent — it is the club's treasure. The
 * hardware (bands, lock, hinges) is gold from the platform metals, so a chest
 * reads as a chest before it reads as anyone's branding.
 *
 * `open` is a prop, not internal state: the parent owns the moment. The lid
 * animates on transform alone (Recipe 19) and simply renders open with no
 * motion under reduced-motion.
 */
import { useId } from 'vue'

withDefaults(
  defineProps<{
    open?: boolean
    /** Names the chest when it is the only content of a control. */
    title?: string
  }>(),
  { open: false, title: undefined },
)

const uid = useId()
</script>

<template>
  <span class="relative inline-block shrink-0">
    <svg
      viewBox="0 0 96 84"
      class="size-full"
      :aria-hidden="title ? undefined : 'true'"
      :role="title ? 'img' : undefined"
    >
      <title v-if="title">{{ title }}</title>

      <defs>
        <linearGradient :id="`body-${uid}`" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stop-color="var(--color-accent-400)" />
          <stop offset="100%" stop-color="var(--color-accent-alt-600)" />
        </linearGradient>
        <linearGradient :id="`lid-${uid}`" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stop-color="var(--color-accent-400)" />
          <stop offset="100%" stop-color="var(--color-accent-alt-500)" />
        </linearGradient>
        <linearGradient :id="`gold-${uid}`" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="var(--color-tier-gold-300)" />
          <stop offset="50%" stop-color="var(--color-tier-gold-500)" />
          <stop offset="100%" stop-color="var(--color-tier-gold-700)" />
        </linearGradient>
        <!-- The light that comes OUT of an open chest. Painted behind the
             body, so the box always occludes its own glow. -->
        <radialGradient :id="`glow-${uid}`" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stop-color="var(--color-tier-gold-300)" stop-opacity="0.95" />
          <stop offset="60%" stop-color="var(--color-tier-gold-500)" stop-opacity="0.35" />
          <stop offset="100%" stop-color="var(--color-tier-gold-500)" stop-opacity="0" />
        </radialGradient>
      </defs>

      <!-- Contact shadow. Grounds the chest so it sits on the surface rather
           than floating over it. -->
      <ellipse cx="48" cy="76" rx="34" ry="5" fill="#000" fill-opacity="0.18" />

      <!-- Spill of light, only once open. -->
      <ellipse
        v-if="open"
        cx="48"
        cy="36"
        rx="40"
        ry="26"
        :fill="`url(#glow-${uid})`"
      />

      <!-- Interior, revealed as the lid swings back. -->
      <path d="M14 34h68v8H14z" fill="#3a1d18" />
      <ellipse v-if="open" cx="48" cy="36" rx="26" ry="7" fill="var(--color-tier-gold-300)" />

      <!-- Body -->
      <rect x="12" y="34" width="72" height="36" rx="5" :fill="`url(#body-${uid})`" />
      <!-- Band and lock: platform gold, so the chest reads as a chest before
           it reads as anyone's brand. -->
      <rect x="12" y="52" width="72" height="6" :fill="`url(#gold-${uid})`" />
      <rect x="41" y="34" width="14" height="36" :fill="`url(#gold-${uid})`" />
      <rect x="40" y="46" width="16" height="15" rx="3" :fill="`url(#gold-${uid})`" />
      <circle cx="48" cy="52" r="2.6" fill="#3a1d18" />
      <path d="M48 52v5" stroke="#3a1d18" stroke-width="2.4" stroke-linecap="round" />

      <!-- Lid. Its own group so one transform swings the whole assembly; the
           origin is the hinge at the back-left of the body. -->
      <g
        class="chest-lid"
        :class="open ? 'chest-lid--open' : ''"
        style="transform-origin: 14px 34px"
      >
        <path d="M12 34V26a36 20 0 0 1 72 0v8z" :fill="`url(#lid-${uid})`" />
        <rect x="41" y="14" width="14" height="20" :fill="`url(#gold-${uid})`" />
        <path d="M12 30h72v4H12z" :fill="`url(#gold-${uid})`" />
        <path
          d="M14 28a34 18 0 0 1 30-14"
          fill="none"
          stroke="#fff"
          stroke-opacity="0.35"
          stroke-width="3"
          stroke-linecap="round"
        />
      </g>

      <!-- Escaping sparkle. Static decoration on the open state, not a loop. -->
      <g v-if="open" fill="var(--color-tier-gold-300)">
        <path d="M22 18l1.6 4.4L28 24l-4.4 1.6L22 30l-1.6-4.4L16 24l4.4-1.6z" />
        <path d="M74 10l1.2 3.3L78.5 15l-3.3 1.2L74 19.5l-1.2-3.3L69.5 15l3.3-1.2z" />
      </g>
    </svg>
  </span>
</template>
