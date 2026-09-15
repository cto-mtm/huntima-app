<script setup lang="ts">
/**
 * What a screen says when it has nothing to show.
 *
 * ── Why this is a component and not a paragraph ──────────────
 * Every empty screen in the app used to be a 36px grey icon over one line of
 * grey text. That is the house style of a settings panel, and this app is a
 * game for twelve-year-olds: the emptiest screens are the FIRST screens a fan
 * ever sees, so "nothing here yet" was the product's first impression and it
 * read as broken rather than as new.
 *
 * An empty state has three jobs and the old one did none of them: show what
 * the thing WILL look like once it has content, say why it is empty in a
 * sentence with some warmth, and offer the one action that fills it.
 *
 * So the art is a real medallion from the reward system — the same object the
 * fan is about to start collecting, struck in `locked` metal. The shelf is
 * not bare; it is waiting. That costs nothing extra, because the art is
 * already there and already re-skins with the tenant.
 *
 * Text comes in as props rather than keys, so a caller passes its own
 * already-translated strings and this component needs no i18n namespace of
 * its own.
 */
import RewardMedallion, {
  type RewardShape,
  type RewardTier,
} from './reward/RewardMedallion.vue'

withDefaults(
  defineProps<{
    /** Which object this screen collects. Pick the one it will really hold. */
    shape?: RewardShape
    tier?: RewardTier
    title: string
    body?: string
  }>(),
  { shape: 'rosette', tier: 'locked', body: undefined },
)
</script>

<template>
  <div class="flex flex-col items-center px-4 py-10 text-center">
    <div class="relative">
      <!-- A bloom behind the art, so the locked metal sits in warm light
           rather than looking switched off. Static gradient, painted once. -->
      <span
        class="absolute -inset-6 rounded-full"
        style="
          background: radial-gradient(
            closest-side,
            color-mix(in srgb, var(--color-accent-400) 30%, transparent),
            transparent
          );
        "
        aria-hidden="true"
      />
      <RewardMedallion :shape="shape" :tier="tier" class="relative size-24 drop-shadow-md">
        <span class="text-2xl font-black text-tier-locked-700" aria-hidden="true">?</span>
      </RewardMedallion>
    </div>

    <h2 class="display-title display-title--sm mt-4 text-2xl">{{ title }}</h2>
    <p v-if="body" class="mt-1.5 max-w-[16rem] text-sm text-muted">{{ body }}</p>

    <!-- The action that fills the screen. Optional: some screens are empty
         because nothing has happened yet and there is genuinely nothing to
         press — an invented CTA is worse than none. -->
    <div v-if="$slots.default" class="mt-5 w-full max-w-[16rem]">
      <slot />
    </div>
  </div>
</template>
