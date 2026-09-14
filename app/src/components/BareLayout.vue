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
  <div class="mx-auto min-h-dvh max-w-5xl bg-canvas px-4">
    <slot />
  </div>
</template>
