<script setup lang="ts">
/**
 * The one shell for the whole app — see docs/shell-architecture.md.
 *
 * Two LEVELS, one chrome. The shell reads its context from the route and
 * swaps exactly two things: the header identity and the nav tab set. Header
 * bar, bottom nav, backdrop and safe-area math are identical at both levels,
 * so moving between them is a re-skin, never a different UI.
 *
 *   PLATFORM level (no tenantSlug param) — Huntima brand
 *     nav: Home · Trophies · Profile
 *   BRAND level (tenantSlug param present) — the org's brand
 *     nav: Huntima (exit up) · Missions · Prize · About
 *
 * The theme itself flips only at the boundary, and that is the router
 * guard's job (tenant activate/deactivate) — this component only reflects
 * which context it is in.
 *
 * ── The chrome is part of the game ───────────────────────────
 * Both bars used to be flat white strips with hairline borders and 20px
 * icons: correct, and completely at odds with a product whose whole pitch is
 * chunky, saturated and playful. They now speak the same language as the
 * rest of the skin — the identity is set in the display face, and the nav is
 * a floating pill bar with a raised gradient key on the active tab, built
 * from the same tactile vocabulary as BaseButton. Nothing about the
 * STRUCTURE changed: same two levels, same tabs, same safe-area math.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, type RouteLocationRaw } from 'vue-router'
import AppIcon, { type IconName } from './AppIcon.vue'
import TeamMark from './TeamMark.vue'
import FanAvatar from './FanAvatar.vue'
import HuntimaMark from './HuntimaMark.vue'
import { useTenantStore } from '../stores/tenant'

const { t } = useI18n()
const route = useRoute()
const tenant = useTenantStore()

/** Brand level when the route carries a tenant slug; platform level otherwise. */
const brandSlug = computed(() =>
  typeof route.params.tenantSlug === 'string' ? route.params.tenantSlug : null,
)
const isBrand = computed(() => brandSlug.value !== null)

interface NavItem {
  key: string
  labelKey: string
  icon: IconName
  to: RouteLocationRaw
  /** Brand-exit tab wears the platform mark instead of a stroked icon. */
  logo?: boolean
}

// Thumb-reach order, most-used first. Tenant tabs carry their slug
// explicitly — named navigation would otherwise need a param the platform
// pages don't have.
const nav = computed<NavItem[]>(() => {
  const slug = brandSlug.value
  if (slug) {
    return [
      // The exit-up tab: back to the platform home, wearing the Huntima mark
      // so the hierarchy reads at a glance.
      { key: 'platform-home', labelKey: 'shell.navHuntima', icon: 'home', to: { name: 'platform-home' }, logo: true },
      { key: 'home', labelKey: 'shell.navMissions', icon: 'missions', to: { name: 'home', params: { tenantSlug: slug } } },
      { key: 'redeem', labelKey: 'shell.navPrize', icon: 'prize', to: { name: 'redeem', params: { tenantSlug: slug } } },
      { key: 'about', labelKey: 'shell.navAbout', icon: 'about', to: { name: 'about', params: { tenantSlug: slug } } },
    ]
  }
  return [
    { key: 'platform-home', labelKey: 'shell.navHome', icon: 'home', to: { name: 'platform-home' } },
    { key: 'trophies', labelKey: 'shell.navTrophies', icon: 'trophies', to: { name: 'trophies' } },
    { key: 'profile', labelKey: 'shell.navProfile', icon: 'profile', to: { name: 'profile' } },
  ]
})

/** Header mark target: the org hub in brand context, the platform home otherwise. */
const headerTo = computed<RouteLocationRaw>(() =>
  brandSlug.value
    ? { name: 'home', params: { tenantSlug: brandSlug.value } }
    : { name: 'platform-home' },
)

// RouterLink's own active-class can't drive the tabs: "home"/"platform-home"
// paths prefix-match their siblings. Match on route name instead. Mission
// and capture screens keep the Missions tab lit.
function isActive(key: string): boolean {
  const current = String(route.name ?? '')
  if (key === 'home') return current === 'home' || current.startsWith('mission')
  if (key === 'platform-home') return current === 'platform-home'
  return current === key
}
</script>

<template>
  <!-- Deliberately NOT bg-canvas: the tinted ground is painted by
       #app-backdrop in the document itself (see index.html), and an opaque
       shell root would sit on top of it. -->
  <div class="flex min-h-dvh flex-col">

    <!-- Header. pt-safe + px-safe keep it clear of the notch. The static
         view-transition-name opts the fixed chrome out of the root group, so
         the page lift moves content while the header holds still.

         No border: the bar is a translucent pane over the backdrop's top
         wash, so the seam between chrome and page is a gradient rather than
         a hairline rule. -->
    <header
      class="fixed inset-x-0 top-0 z-20 bg-canvas/80 pt-safe px-safe backdrop-blur-md"
      style="view-transition-name: app-header"
    >
      <div class="mx-auto flex h-16 w-full max-w-md items-center justify-between gap-2 px-4">
        <RouterLink :to="headerTo" class="flex min-w-0 items-center gap-2">
          <!-- The identity is set in the DISPLAY face at both levels. The
               club's name is the loudest thing on its own page — which is
               the entire promise of a white-label product, and it was
               previously set at 14px beside a 28px logo. -->
          <template v-if="isBrand">
            <TeamMark class="shrink-0" />
            <span
              class="display-title display-title--sm truncate text-2xl leading-tight"
              translate="no"
            >
              {{ tenant.settings.teamName }}
            </span>
          </template>
          <template v-else>
            <HuntimaMark class="size-8 shrink-0" />
            <span class="display-title display-title--sm text-2xl leading-tight" translate="no">
              {{ t('shell.wordmark') }}
            </span>
          </template>
        </RouterLink>

        <!-- Identity only. The language toggle used to sit here, eating a
             third of the header on a 360px phone for a control a fan touches
             once, if ever — it lives on the profile page now, beside the
             other things about them. The pre-session screens (landing, entry,
             sign-in) keep their own inline switcher, because somebody who
             cannot read the page yet has to be able to change it before they
             have a profile at all. -->
        <div class="flex shrink-0 items-center gap-2">
          <!-- The avatar is a round key like every other control in the skin:
               a gradient ring with a hard bottom edge it presses onto. -->
          <RouterLink
            :to="{ name: 'profile' }"
            :aria-label="t('profile.title')"
            class="rounded-full bg-gradient-to-br from-accent-400 to-accent-alt-500 p-0.5 shadow-[0_2px_0_0_var(--color-accent-alt-600)] transition-transform duration-150 active:translate-y-[2px] active:shadow-none"
          >
            <FanAvatar class="ring-2 ring-surface" />
          </RouterLink>
        </div>
      </div>
    </header>

    <!-- The single scrolling region. Bottom padding clears the floating nav
         plus the home indicator; max-w-md centers fan content into a phone
         column on desktop. -->
    <main class="relative z-10 mx-auto w-full max-w-md flex-1 px-gutter pb-32 mt-header-safe">
      <slot />
    </main>

    <!-- Nav. The bar FLOATS: rounded, inset from the screen edges, lifted off
         the ground with a real shadow. A full-bleed strip with a hairline top
         border is the right answer for a utility app and the wrong one here —
         it was the last part of the UI still dressed as a form.

         The <nav> itself is pointer-events-none so the gap either side of the
         pill doesn't swallow taps meant for the page underneath. -->
    <nav
      class="pointer-events-none fixed inset-x-0 bottom-0 z-20 pb-safe px-safe"
      style="view-transition-name: app-nav"
    >
      <div class="mx-auto w-full max-w-md px-3 pb-2">
        <ul
          class="pointer-events-auto flex items-stretch justify-around gap-1 rounded-full bg-surface/95 p-1.5 shadow-lg shadow-brand-900/15 ring-1 ring-brand-100 backdrop-blur-md"
        >
          <li v-for="item in nav" :key="item.key" class="min-w-0 flex-1">
            <!-- The active tab is a raised gradient key — the same candy
                 surface as the primary CTA, so "where you are" and "what to
                 press" speak one language. Its move between tabs cross-fades
                 for free (the nav is its own view-transition group). -->
            <RouterLink
              :to="item.to"
              class="flex flex-col items-center gap-0.5 rounded-full px-1 py-2 text-[10px] font-extrabold uppercase tracking-wide transition-transform duration-150 active:scale-95"
              :class="
                isActive(item.key)
                  ? 'bg-gradient-to-br from-accent-400 to-accent-alt-500 text-white shadow-[0_3px_0_0_var(--color-accent-alt-600)]'
                  : 'text-muted'
              "
              :aria-current="isActive(item.key) ? 'page' : undefined"
            >
              <!-- The exit-up tab shows the Huntima mark; a white chip keeps
                   it legible on the active gradient. -->
              <HuntimaMark
                v-if="item.logo"
                class="size-6 shrink-0 rounded-full"
                :class="isActive(item.key) ? 'bg-white p-0.5' : ''"
              />
              <AppIcon v-else :name="item.icon" class="size-6 shrink-0" />
              <span class="w-full truncate text-center">{{ t(item.labelKey) }}</span>
            </RouterLink>
          </li>
        </ul>
      </div>
    </nav>
  </div>
</template>
