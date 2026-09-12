<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import LocaleSwitcher from './LocaleSwitcher.vue'
import AmbientBackdrop from './AmbientBackdrop.vue'
import AppIcon, { type IconName } from './AppIcon.vue'
import TeamMark from './TeamMark.vue'
import FanAvatar from './FanAvatar.vue'
import { useTenantStore } from '../stores/tenant'

const { t } = useI18n()
const route = useRoute()
const tenant = useTenantStore()

// Order matters: this is thumb-reach order on a phone, most-used first.
const NAV: { name: string; labelKey: string; icon: IconName }[] = [
  { name: 'home', labelKey: 'shell.navMissions', icon: 'missions' },
  { name: 'trophies', labelKey: 'shell.navTrophies', icon: 'trophies' },
  { name: 'redeem', labelKey: 'shell.navPrize', icon: 'prize' },
  { name: 'about', labelKey: 'shell.navAbout', icon: 'about' },
]

// RouterLink's own active-class can't be used for the "home" tab: its path
// is "/", which prefix-matches every route, so every tab would light up.
// The mission and capture screens belong under Missions, hence the prefix.
function isActive(name: string): boolean {
  const current = String(route.name ?? '')
  if (name === 'home') return current === 'home' || current.startsWith('mission')
  return current === name
}
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-canvas">
    <!-- The drifting brand shapes (Recipe 12). Rendered before <main> and
         painted under it. Explicit z-0 (not just DOM order): during the
         Recipe 1 page-lift the content gets its own view-transition group and
         is composited on a transformed layer, so relying on `z-index: auto` +
         DOM order stops holding — the separately-snapshotted backdrop would
         paint OVER the transforming content. A concrete z-index below the
         content's keeps the order through the transition. pointer-events-none
         keeps taps falling through to the content. -->
    <AmbientBackdrop class="z-0" style="view-transition-name: app-backdrop" />

    <!-- Header. pt-safe + px-safe keep it clear of the notch and of
         landscape rounded corners; the same markup is correct in a
         browser tab, where the env() values resolve to 0.

         The static view-transition-name (safe: AppShell renders once) opts
         the fixed chrome out of the root group, so Recipe 1's page lift
         moves the content while header, nav and backdrop hold still. -->
    <header
      class="fixed inset-x-0 top-0 z-20 border-b border-brand-100 bg-surface/90 pt-safe px-safe backdrop-blur"
      style="view-transition-name: app-header"
    >
      <div class="mx-auto flex h-14 w-full max-w-md items-center justify-between px-4">
        <RouterLink :to="{ name: 'home' }" class="flex items-center gap-2">
          <TeamMark />
          <span class="text-sm font-bold text-brand-900" translate="no">{{ tenant.settings.teamName }}</span>
        </RouterLink>
        <div class="flex items-center gap-2">
          <LocaleSwitcher />
          <RouterLink :to="{ name: 'profile' }" :aria-label="t('profile.title')">
            <FanAvatar />
          </RouterLink>
        </div>
      </div>
    </header>

    <!-- The single scrolling region. Bottom padding clears the nav bar
         plus the home indicator. max-w-md centers the fan content into a
         phone-width column on a desktop instead of letting it span the whole
         window — the same framing the pre-session screens use. -->
    <main class="relative z-10 mx-auto w-full max-w-md flex-1 px-gutter pb-28 mt-header-safe">
      <slot />
    </main>

    <nav
      class="fixed inset-x-0 bottom-0 z-20 border-t border-brand-100 bg-surface/95 pb-safe px-safe backdrop-blur"
      style="view-transition-name: app-nav"
    >
      <ul class="mx-auto flex max-w-md items-stretch justify-around">
        <li v-for="item in NAV" :key="item.name" class="flex-1">
          <!-- The active tab wears a filled pill. Its move between tabs is
               animated for free: the nav is its own view-transition group,
               so each navigation cross-fades old and new pill position. -->
          <RouterLink
            :to="{ name: item.name }"
            class="flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold"
            :class="isActive(item.name) ? 'text-brand-700' : 'text-muted'"
            :aria-current="isActive(item.name) ? 'page' : undefined"
          >
            <span
              class="flex h-6 items-center justify-center rounded-full px-4"
              :class="isActive(item.name) ? 'bg-brand-600 text-white shadow-sm' : ''"
            >
              <AppIcon :name="item.icon" class="size-5" />
            </span>
            {{ t(item.labelKey) }}
          </RouterLink>
        </li>
      </ul>
    </nav>
  </div>
</template>
