<script setup lang="ts">
/**
 * The org console's shell — the ONE owner of console chrome.
 *
 * The admin console is deliberately OUTSIDE the two-level fan AppShell: it is a
 * wide, desktop-leaning surface, not the phone shell (see
 * docs/shell-architecture.md, which lists the console among the bare surfaces).
 * But "outside the fan shell" must not mean "every page assembles its own
 * chrome": before this, each of the five admin pages hand-imported <AdminNav>
 * and any page that forgot it shipped with no navigation. Here the nav and the
 * wide column are owned once, so console pages are pure content.
 */
import AdminNav from './admin/AdminNav.vue'
</script>

<template>
  <div class="mx-auto min-h-dvh max-w-5xl bg-canvas px-4">
    <AdminNav />
    <slot />
  </div>
</template>
