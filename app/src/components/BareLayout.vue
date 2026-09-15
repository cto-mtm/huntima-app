<script setup lang="ts">
/**
 * Out-of-app surfaces: the signed-out hero, sign-in, staff login, the org
 * picker, the tenant welcome, and 404. No shell — a page full of tabs that all
 * bounce to sign-in is worse than a poster with one button
 * (docs/shell-architecture.md).
 *
 * A neutral full-height canvas. Each bare page still centers its own phone
 * column inside, so this owns only the page background and outer gutter — the
 * single, named home for what used to be an inline branch in App.vue.
 */
</script>

<template>
  <!-- `relative z-10` is load-bearing. #app-backdrop (index.html) is
       position:fixed with z-index:0, and CSS paints POSITIONED elements above
       the backgrounds of non-positioned blocks — so a plain static wrapper,
       however opaque, renders UNDERNEATH the backdrop and its whole page
       disappears. Any full-page layout that means to cover the fan ground has
       to be positioned above it, not merely opaque. -->
  <!-- Full-bleed opaque, with the column inside it: the background has to
       span the whole viewport, not just the 5xl column. -->
  <div class="relative z-10 min-h-dvh bg-canvas">
    <div class="mx-auto max-w-5xl px-4">
      <slot />
    </div>
  </div>
</template>
