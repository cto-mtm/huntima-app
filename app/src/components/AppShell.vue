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
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, type RouteLocationRaw } from 'vue-router'
import LocaleSwitcher from './LocaleSwitcher.vue'
import AmbientBackdrop from './AmbientBackdrop.vue'
import AppIcon, { type IconName } from './AppIcon.vue'
import TeamMark from './TeamMark.vue'
import FanAvatar from './FanAvatar.vue'
import { useTenantStore } from '../stores/tenant'
import huntimaLogo from '../assets/logo.svg'

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
  /** Brand-exit tab wears the platform logo instead of a stroked icon. */
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
  <div class="flex min-h-dvh flex-col bg-canvas">
    <!-- The drifting brand shapes (Recipe 12). Rendered before <main> and
         painted under it. Explicit z-0 keeps it below the content through the
         page-lift view transition (see docs/animations.md § 1b). -->
    <AmbientBackdrop class="z-0" style="view-transition-name: app-backdrop" />

    <!-- Header. pt-safe + px-safe keep it clear of the notch. The static
         view-transition-name opts the fixed chrome out of the root group, so
         the page lift moves content while the header holds still. -->
    <header
      class="fixed inset-x-0 top-0 z-20 border-b border-brand-100 bg-surface/90 pt-safe px-safe backdrop-blur"
      style="view-transition-name: app-header"
    >
      <div class="mx-auto flex h-14 w-full max-w-md items-center justify-between px-4">
        <RouterLink :to="headerTo" class="flex items-center gap-2">
          <!-- Brand level: the org's mark + name. Platform level: the
               Huntima logo + display-styled wordmark. -->
          <template v-if="isBrand">
            <TeamMark />
            <span class="text-sm font-bold text-brand-900" translate="no">{{ tenant.settings.teamName }}</span>
          </template>
          <template v-else>
            <img :src="huntimaLogo" alt="" class="size-7" aria-hidden="true" />
            <span class="display-title display-title--sm text-lg" translate="no">
              {{ t('shell.wordmark') }}
            </span>
          </template>
        </RouterLink>
        <div class="flex items-center gap-2">
          <LocaleSwitcher />
          <RouterLink :to="{ name: 'profile' }" :aria-label="t('profile.title')">
            <FanAvatar />
          </RouterLink>
        </div>
      </div>
    </header>

    <!-- The single scrolling region. Bottom padding clears the nav bar plus
         the home indicator; max-w-md centers fan content into a phone column
         on desktop. -->
    <main class="relative z-10 mx-auto w-full max-w-md flex-1 px-gutter pb-28 mt-header-safe">
      <slot />
    </main>

    <nav
      class="fixed inset-x-0 bottom-0 z-20 border-t border-brand-100 bg-surface/95 pb-safe px-safe backdrop-blur"
      style="view-transition-name: app-nav"
    >
      <ul class="mx-auto flex max-w-md items-stretch justify-around">
        <li v-for="item in nav" :key="item.key" class="flex-1">
          <!-- The active tab wears a filled pill; its move between tabs
               cross-fades for free (the nav is its own view-transition group). -->
          <RouterLink
            :to="item.to"
            class="flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold"
            :class="isActive(item.key) ? 'text-brand-700' : 'text-muted'"
            :aria-current="isActive(item.key) ? 'page' : undefined"
          >
            <span
              class="flex h-6 items-center justify-center rounded-full px-4"
              :class="isActive(item.key) ? 'bg-brand-600 text-white shadow-sm' : ''"
            >
              <!-- The exit-up tab shows the Huntima logo; a white chip keeps
                   it legible on the active pill. -->
              <img
                v-if="item.logo"
                :src="huntimaLogo"
                alt=""
                class="size-5 rounded-full"
                :class="isActive(item.key) ? 'bg-white p-0.5' : ''"
                aria-hidden="true"
              />
              <AppIcon v-else :name="item.icon" class="size-5" />
            </span>
            {{ t(item.labelKey) }}
          </RouterLink>
        </li>
      </ul>
    </nav>
  </div>
</template>
