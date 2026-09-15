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
  <!-- `relative z-10` is load-bearing. #app-backdrop (index.html) is
       position:fixed with z-index:0, and CSS paints POSITIONED elements above
       the backgrounds of non-positioned blocks — so a plain static wrapper,
       however opaque, renders UNDERNEATH the backdrop and its whole page
       disappears. Any full-page layout that means to cover the fan ground has
       to be positioned above it, not merely opaque. -->
  <!-- Full-bleed opaque for the same reason as BareLayout: the console is
       not the fan shell and must not wear its backdrop. -->
  <div class="relative z-10 min-h-dvh bg-canvas">
    <div class="mx-auto max-w-5xl px-4">
      <AdminNav />
      <slot />
    </div>
  </div>
</template>
