<script setup lang="ts">
/**
 * The org console's chrome, owned by ConsoleShell and rendered once.
 *
 * Two rows. The identity row says WHERE you are: the Huntima mark (up to the
 * platform), a separator that echoes the URL, then this tenant's own mark and
 * name — which IS the switcher (naming the current space and making the name
 * the control beats a separate "switch" link that hid the current one).
 *
 * The tab row says what you are editing, and it ADAPTS to the tenant:
 *   - an ORGANIZATION gets the full surface — Hunts, Branding, Team;
 *   - a PERSONAL space (a wedding host, a teacher) is never shown "Team" or
 *     the word "organization", and only sees a look-and-feel surface once its
 *     plan can actually brand. On the free plan it is just Hunts.
 * Kind drives vocabulary; plan drives capability. See docs/shell-architecture
 * and BUSINESS_MODEL.md.
 *
 * The platform exit is a MARK, not the words "Huntima home": the console wears
 * this tenant's palette, so a text link in its colors would not read as a way
 * out. It mirrors the fan app's brand-level exit tab.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { canBrand } from 'shared'
import AppIcon from '../AppIcon.vue'
import TeamMark from '../TeamMark.vue'
import LocaleSwitcher from '../LocaleSwitcher.vue'
import { useSessionStore } from '../../stores/session'
import { useTenantStore } from '../../stores/tenant'
import { useOrgsStore } from '../../stores/orgs'
import huntimaLogo from '../../assets/logo.svg'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const tenant = useTenantStore()
const orgs = useOrgsStore()

// The active tenant's kind + plan, from the summary the requiresOrg guard loads
// before any console page renders. Kind → vocabulary; plan → branding gate.
const summary = computed(() => orgs.summaryFor(tenant.slug))
const isOrg = computed(() => (summary.value?.kind ?? 'org') === 'org')
const canCustomizeBrand = computed(() => canBrand(summary.value?.plan ?? 'free'))

interface Tab {
  name: string
  labelKey: string
}

const tabs = computed<Tab[]>(() => {
  const list: Tab[] = [{ name: 'admin-hunts', labelKey: 'hunts.navHunts' }]
  if (isOrg.value) {
    list.push({ name: 'admin-branding', labelKey: 'hunts.navBranding' })
    list.push({ name: 'admin-members', labelKey: 'hunts.navTeam' })
  } else if (canCustomizeBrand.value) {
    list.push({ name: 'admin-branding', labelKey: 'hunts.navLook' })
  }
  return list
})

/** The picker is where any space is switched; only the wording differs. */
const switchLabelKey = computed(() => (isOrg.value ? 'hunts.navOrgs' : 'hunts.navSpaces'))

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
          :title="t(switchLabelKey)"
          class="flex min-w-0 items-center gap-1.5 rounded-full py-1 pl-1 pr-2 hover:bg-brand-50"
        >
          <TeamMark />
          <span class="truncate text-sm font-bold text-brand-900" translate="no">
            {{ tenant.settings.teamName }}
          </span>
          <AppIcon name="chevronDown" class="size-4 shrink-0 text-muted" />
          <span class="sr-only">{{ t(switchLabelKey) }}</span>
        </RouterLink>
      </div>

      <!-- Account + language, quietly. Signing out is not navigation and should
           not wear the same weight as a tab. -->
      <div class="flex shrink-0 items-center gap-2">
        <LocaleSwitcher />
        <div class="text-right">
          <p v-if="session.email" class="truncate text-[11px] text-muted" translate="no">
            {{ session.email }}
          </p>
          <button
            type="button"
            class="text-xs font-semibold text-muted hover:text-brand-700"
            @click="signOut"
          >
            {{ t('entry.signOut') }}
          </button>
        </div>
      </div>
    </div>

    <!-- ── Sections ─────────────────────────────────────────────── -->
    <nav class="mt-3 flex gap-1">
      <RouterLink
        v-for="tab in tabs"
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
