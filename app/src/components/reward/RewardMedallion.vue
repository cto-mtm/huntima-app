<script setup lang="ts">
/**
 * Every piece of reward hardware in the app, as ONE component.
 *
 * The mockups ask for rosettes, medals, prize ribbons, cups, vouchers,
 * keychains, map pins and lens badges, each in five rarities, each locked or
 * earned — roughly forty pictures. Forty files is forty things to re-draw the
 * day the brand moves, and a guarantee that the bronze cup and the bronze
 * rosette drift apart. So it is one component with two axes instead:
 *
 *   shape — what the object IS (rosette, cup, ticket, …)
 *   tier  — what it is MADE OF (locked, bronze, silver, gold, rare)
 *
 * ── The blend seam ────────────────────────────────────────────
 * The METAL is platform-semantic and never tenant-themed (see the token block
 * in main.css): silver has to read as silver at every venue, or a rarity
 * ladder means nothing across the platform. The FACE inside the frame is the
 * tenant's accent gradient. Platform owns the metal, the club owns the crest —
 * the same split as the display font and its gradient.
 *
 * ── Why some geometry is computed ─────────────────────────────
 * The rosette scallop and the lens aperture are radial constructions. Hand
 * written path data for those is unreadable and unadjustable; three lines of
 * trigonometry are neither. Everything that is genuinely a drawing (the cup,
 * the ticket notches) stays literal path data, because trigonometry would be
 * the wrong tool there.
 *
 * Decorative by default (`aria-hidden`). Pass `title` only when the medallion
 * is the sole content of a control and nothing else names it.
 */
import { computed, useId } from 'vue'
import AppIcon, { type IconName } from '../AppIcon.vue'

export type RewardShape =
  | 'rosette'
  | 'medal'
  | 'ribbon'
  | 'cup'
  | 'ticket'
  | 'keychain'
  | 'pin'
  | 'lens'

export type RewardTier = 'locked' | 'bronze' | 'silver' | 'gold' | 'rare'

const props = withDefaults(
  defineProps<{
    shape?: RewardShape
    tier?: RewardTier
    /** Convenience emblem on the face. Ignored when the default slot is used. */
    emblem?: IconName
    /**
     * Overrides the crest color with a flat one — used where the CALLER's
     * item already has an identity color, notably a mission's own color on
     * the venue map. Without it a map of eight pins is eight identical
     * accent discs. Leave unset everywhere else: the accent gradient is what
     * makes a medallion look like this club's.
     */
    crest?: string
    /** Names the medallion for assistive tech. Omit when something else does. */
    title?: string
  }>(),
  { shape: 'rosette', tier: 'gold', emblem: undefined, crest: undefined, title: undefined },
)

// Gradient ids must be unique per INSTANCE: a reward grid renders dozens of
// these, and duplicate ids mean every medallion silently inherits the first
// one's fill. useId() is scoped per app instance and SSR-stable.
const uid = useId()
const metalId = computed(() => `m-${uid}`)
const faceId = computed(() => `f-${uid}`)
const shineId = computed(() => `s-${uid}`)

/** A locked reward is a silhouette: grey metal AND a grey face. */
const isLocked = computed(() => props.tier === 'locked')

// Token lookups rather than a hardcoded color map: adding a tier means adding
// three custom properties and one union member, never touching the drawing.
const metal = computed(() => ({
  light: `var(--color-tier-${props.tier}-300)`,
  body: `var(--color-tier-${props.tier}-500)`,
  shade: `var(--color-tier-${props.tier}-700)`,
}))

/**
 * Rare is the one tier that is not a metal. Foil shifts hue across the sweep —
 * that is the whole visual signal for "rare" in every trading card the target
 * age bracket has ever held — so its mid stop jumps to cyan instead of easing
 * between two lightnesses of one hue.
 */
const midStop = computed(() =>
  props.tier === 'rare' ? 'var(--color-tier-rare-alt-500)' : metal.value.body,
)

/* ── Radial constructions ─────────────────────────────────────── */

/** A scalloped rosette outline: `points` lobes swung between two radii. */
function radialPath(points: number, outer: number, inner: number, cx = 32, cy = 32): string {
  const step = Math.PI / points
  let d = ''
  for (let i = 0; i < points * 2; i += 1) {
    const r = i % 2 === 0 ? outer : inner
    const a = i * step - Math.PI / 2
    d += `${i === 0 ? 'M' : 'L'}${(cx + Math.cos(a) * r).toFixed(2)} ${(cy + Math.sin(a) * r).toFixed(2)}`
  }
  return `${d}Z`
}

/** One blade of a camera aperture — the Huntima mark's own geometry. */
function bladePath(i: number, count = 6, outer = 26, inner = 8, cx = 32, cy = 32): string {
  const step = (Math.PI * 2) / count
  const a0 = i * step - Math.PI / 2
  const a1 = a0 + step
  const at = (a: number, r: number): string =>
    `${(cx + Math.cos(a) * r).toFixed(2)} ${(cy + Math.sin(a) * r).toFixed(2)}`
  return `M${at(a0, inner)}L${at(a0, outer)}A${outer} ${outer} 0 0 1 ${at(a1, outer)}Z`
}

// Computed once at module scope: the geometry never depends on props.
const ROSETTE_OUTER = radialPath(12, 30, 24.5)
const ROSETTE_INNER = radialPath(12, 25, 21)
const BLADES = [0, 1, 2, 3, 4, 5].map((i) => bladePath(i))

/**
 * Where the crest sits, per shape, in viewBox units. Drives both the face disc
 * and the emblem overlay, so the two can never drift apart.
 */
const FACES: Record<RewardShape, { cx: number; cy: number; r: number }> = {
  rosette: { cx: 32, cy: 32, r: 18 },
  medal: { cx: 32, cy: 42, r: 15 },
  ribbon: { cx: 32, cy: 27, r: 16 },
  cup: { cx: 32, cy: 25, r: 10 },
  ticket: { cx: 21, cy: 32, r: 9.5 },
  keychain: { cx: 32, cy: 40, r: 11 },
  pin: { cx: 32, cy: 24, r: 9 },
  lens: { cx: 32, cy: 32, r: 8 },
}

const face = computed(() => FACES[props.shape])

/**
 * Crest fill. A locked reward is a silhouette, so it takes metal even when a
 * crest color was passed — an explicit color must not leak the identity of a
 * reward the fan has not earned.
 */
const crestFrom = computed(() => {
  if (isLocked.value) return metal.value.light
  return props.crest ?? 'var(--color-accent-400)'
})
const crestTo = computed(() => {
  if (isLocked.value) return metal.value.body
  return props.crest ?? 'var(--color-accent-alt-500)'
})

/**
 * The emblem overlays the face as normal DOM rather than a nested <svg>, so it
 * can be any AppIcon — or arbitrary slot content, like the "?" of a mystery
 * slot — without re-expressing it as path data. Positioned in percentages off
 * the same FACES entry the disc uses, so it tracks any rendered size.
 */
const emblemStyle = computed(() => {
  const f = face.value
  const pct = (n: number): string => `${(n / 64) * 100}%`
  return {
    left: pct(f.cx - f.r),
    top: pct(f.cy - f.r),
    width: pct(f.r * 2),
    height: pct(f.r * 2),
  }
})
</script>

<template>
  <span class="relative inline-block shrink-0">
    <svg
      viewBox="0 0 64 64"
      class="size-full"
      :aria-hidden="props.title ? undefined : 'true'"
      :role="props.title ? 'img' : undefined"
    >
      <title v-if="props.title">{{ props.title }}</title>

      <defs>
        <!-- Struck metal, lit from the top-left and shaded to the
             bottom-right. One gradient drives every shape, which is what keeps
             a bronze cup and a bronze rosette reading as the same alloy. -->
        <linearGradient :id="metalId" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" :stop-color="metal.light" />
          <stop offset="48%" :stop-color="midStop" />
          <stop offset="100%" :stop-color="metal.shade" />
        </linearGradient>

        <!-- The tenant's crest. Locked rewards get metal here too: a
             silhouette must not advertise the prize in full color. -->
        <linearGradient :id="faceId" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" :stop-color="crestFrom" />
          <stop offset="100%" :stop-color="crestTo" />
        </linearGradient>

        <!-- A single specular band across the upper third. Static: this is the
             drawing, not an animation. -->
        <linearGradient :id="shineId" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#fff" stop-opacity="0.5" />
          <stop offset="55%" stop-color="#fff" stop-opacity="0.05" />
          <stop offset="100%" stop-color="#fff" stop-opacity="0" />
        </linearGradient>
      </defs>

      <!-- ── ROSETTE — the default badge ─────────────────────────── -->
      <g v-if="props.shape === 'rosette'">
        <path :d="ROSETTE_OUTER" :fill="`url(#${metalId})`" />
        <path :d="ROSETTE_INNER" fill="#fff" fill-opacity="0.22" />
        <circle cx="32" cy="32" :r="face.r + 2.5" :fill="metal.shade" fill-opacity="0.55" />
      </g>

      <!-- ── MEDAL — a disc on a neck ribbon ─────────────────────── -->
      <g v-else-if="props.shape === 'medal'">
        <!-- The straps are cloth, not metal, so they are one of the places the
             club's own color gets to shout. -->
        <path d="M18 3h9l10 24-9 4z" fill="var(--color-accent-500)" />
        <path d="M46 3h-9L27 27l9 4z" fill="var(--color-accent-alt-600)" />
        <circle cx="32" cy="42" :r="face.r + 4" :fill="`url(#${metalId})`" />
        <circle cx="32" cy="42" :r="face.r + 1.5" :fill="metal.shade" fill-opacity="0.5" />
      </g>

      <!-- ── RIBBON — the county-fair prize rosette, with tails ──── -->
      <g v-else-if="props.shape === 'ribbon'">
        <path d="M25 38 17 62l8.5-4.5L31 61z" fill="var(--color-accent-alt-600)" />
        <path d="M39 38l8 24-8.5-4.5L33 61z" fill="var(--color-accent-500)" />
        <circle cx="32" cy="27" :r="face.r + 5" :fill="`url(#${metalId})`" />
        <circle cx="32" cy="27" :r="face.r + 2" :fill="metal.shade" fill-opacity="0.5" />
      </g>

      <!-- ── CUP — the trophy ────────────────────────────────────── -->
      <g v-else-if="props.shape === 'cup'">
        <!-- Handles first, so the bowl paints over their inner edge. -->
        <path
          d="M18 16h-6a10 10 0 0 0 10 12M46 16h6a10 10 0 0 1-10 12"
          fill="none"
          :stroke="metal.body"
          stroke-width="4"
          stroke-linecap="round"
        />
        <path d="M17 11h30v14c0 8.3-6.7 15-15 15s-15-6.7-15-15z" :fill="`url(#${metalId})`" />
        <path d="M29 39h6v8h-6z" :fill="metal.shade" />
        <rect x="19" y="47" width="26" height="7" rx="3" :fill="`url(#${metalId})`" />
        <path d="M17 11h30v3H17z" fill="#fff" fill-opacity="0.35" />
      </g>

      <!-- ── TICKET — a voucher, notched so it reads as tearable ─── -->
      <g v-else-if="props.shape === 'ticket'">
        <path
          d="M10 16h44a4 4 0 0 1 4 4v3a6 6 0 0 0 0 18v3a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4v-3a6 6 0 0 0 0-18v-3a4 4 0 0 1 4-4z"
          :fill="`url(#${metalId})`"
        />
        <path
          d="M36 18v28"
          :stroke="metal.shade"
          stroke-width="1.5"
          stroke-dasharray="3 3"
          stroke-linecap="round"
        />
        <path d="M10 16h44a4 4 0 0 1 4 4v1H6v-1a4 4 0 0 1 4-4z" fill="#fff" fill-opacity="0.3" />
      </g>

      <!-- ── KEYCHAIN — a tag on a split ring ────────────────────── -->
      <g v-else-if="props.shape === 'keychain'">
        <!-- The dash gap IS the split in the ring. -->
        <circle
          cx="32"
          cy="13"
          r="7"
          fill="none"
          :stroke="metal.body"
          stroke-width="3.5"
          stroke-linecap="round"
          stroke-dasharray="36 8"
        />
        <rect x="15" y="21" width="34" height="37" rx="9" :fill="`url(#${metalId})`" />
        <circle cx="32" cy="27" r="3" :fill="metal.shade" />
        <rect x="15" y="21" width="34" height="4" rx="2" fill="#fff" fill-opacity="0.35" />
      </g>

      <!-- ── PIN — the Huntima mark: a map drop with a lens in it ── -->
      <g v-else-if="props.shape === 'pin'">
        <path
          d="M32 3c-11.6 0-21 9.4-21 21 0 15.2 21 37 21 37s21-21.8 21-37c0-11.6-9.4-21-21-21z"
          :fill="`url(#${metalId})`"
        />
        <circle cx="32" cy="24" :r="face.r + 3" :fill="metal.shade" fill-opacity="0.5" />
      </g>

      <!-- ── LENS — the aperture at the heart of the mark ────────── -->
      <g v-else>
        <circle cx="32" cy="32" r="30" :fill="`url(#${metalId})`" />
        <circle cx="32" cy="32" r="27" :fill="metal.shade" fill-opacity="0.45" />
        <path
          v-for="(d, i) in BLADES"
          :key="i"
          :d="d"
          :fill="isLocked ? metal.light : 'var(--color-accent-400)'"
          :fill-opacity="i % 2 === 0 ? 0.95 : 0.6"
        />
      </g>

      <!-- The crest, drawn for every shape from the same FACES entry the
           emblem overlay reads, so frame and emblem cannot drift apart. -->
      <circle :cx="face.cx" :cy="face.cy" :r="face.r" :fill="`url(#${faceId})`" />
      <circle :cx="face.cx" :cy="face.cy" :r="face.r" :fill="`url(#${shineId})`" />
    </svg>

    <!-- Emblem overlay. Normal DOM on purpose: any AppIcon, or slot content
         such as a mystery "?", without re-drawing it as path data. -->
    <span
      class="pointer-events-none absolute flex items-center justify-center"
      :style="emblemStyle"
      aria-hidden="true"
    >
      <slot>
        <AppIcon
          v-if="props.emblem"
          :name="props.emblem"
          class="size-[62%]"
          :class="isLocked ? 'text-tier-locked-700' : 'text-white'"
        />
      </slot>
    </span>
  </span>
</template>
