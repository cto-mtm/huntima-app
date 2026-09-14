<script setup lang="ts">
/**
 * The org console's chrome.
 *
 * Two rows, because they answer two different questions. The identity row
 * says WHERE you are: the Huntima mark (up to the platform), a separator that
 * echoes the URL, then this org's own mark and name. The tab row says what you
 * are editing. Before this, the header said neither — it listed three tabs and
 * three text links at equal weight, and never once named the organization
 * whose branding the next screen rewrites.
 *
 * The org name IS the switcher. "Switch organization" as a separate link made
 * the current org invisible while offering to leave it; naming it and making
 * the name the control does both jobs in one place.
 *
 * The platform exit is a MARK, not the words "Huntima home". The console is
 * already wearing this org's palette (the router guard themes any slugged
 * route), so a text link in club colors does not read as a way out. It also
 * mirrors the fan app, where the brand level's leading nav tab wears the
 * Huntima logo to go up a level. See docs/shell-architecture.md.
 */
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '../AppIcon.vue'
import TeamMark from '../TeamMark.vue'
import { useSessionStore } from '../../stores/session'
import { useTenantStore } from '../../stores/tenant'
import huntimaLogo from '../../assets/logo.svg'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const tenant = useTenantStore()

const TABS = [
  { name: 'admin-hunts', labelKey: 'hunts.navHunts' },
  { name: 'admin-branding', labelKey: 'hunts.navBranding' },
  { name: 'admin-members', labelKey: 'hunts.navTeam' },
] as const

function isActive(name: string): boolean {
  // The hunt editor and stats are children of Hunts, so they keep that tab lit.
  return name === 'admin-hunts'
    ? String(route.name ?? '').startsWith('admin-hunt')
    : route.name === name
}

async function signOut(): Promise<void> {
  await session.signOutAll()
  // The landing page, not a fan welcome screen: someone leaving a console is
  // done for the day, not about to play the hunt they just built.
  void router.push({ name: 'landing' })
}
</script>

<template>
  <header class="border-b border-brand-100 py-3">
    <!-- ── Identity: where am I, and how do I leave ──────────────── -->
    <div class="flex items-center justify-between gap-3">
      <div class="flex min-w-0 items-center gap-2">
        <RouterLink
          :to="{ name: 'platform-home' }"
          :aria-label="t('hunts.navPlatform')"
          :title="t('hunts.navPlatform')"
          class="shrink-0"
        >
          <img :src="huntimaLogo" alt="" class="size-7" />
        </RouterLink>

        <span class="select-none text-brand-200" aria-hidden="true">/</span>

        <RouterLink
          :to="{ name: 'orgs' }"
          :title="t('hunts.navOrgs')"
          class="flex min-w-0 items-center gap-1.5 rounded-full py-1 pl-1 pr-2 hover:bg-brand-50"
        >
          <TeamMark />
          <span class="truncate text-sm font-bold text-brand-900" translate="no">
            {{ tenant.settings.teamName }}
          </span>
          <AppIcon name="chevronDown" class="size-4 shrink-0 text-muted" />
          <span class="sr-only">{{ t('hunts.navOrgs') }}</span>
        </RouterLink>
      </div>

      <!-- Account, quietly. Signing out is not navigation and should not wear
           the same weight as a tab. -->
      <div class="shrink-0 text-right">
        <p v-if="session.email" class="truncate text-[11px] text-muted" translate="no">
          {{ session.email }}
        </p>
        <button type="button" class="text-xs font-semibold text-muted hover:text-brand-700" @click="signOut">
          {{ t('entry.signOut') }}
        </button>
      </div>
    </div>

    <!-- ── Sections ─────────────────────────────────────────────── -->
    <nav class="mt-3 flex gap-1">
      <RouterLink
        v-for="tab in TABS"
        :key="tab.name"
        :to="{ name: tab.name }"
        class="rounded-full px-3 py-1.5 text-sm font-semibold"
        :class="isActive(tab.name) ? 'bg-brand-600 text-white' : 'text-brand-700 hover:bg-brand-50'"
      >
        {{ t(tab.labelKey) }}
      </RouterLink>
    </nav>
  </header>
</template>
