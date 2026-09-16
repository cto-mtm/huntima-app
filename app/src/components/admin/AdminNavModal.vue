<script setup lang="ts">
/**
 * The console's navigation, in a modal opened from AdminNav's menu button.
 *
 * Holds everything the old two-row console header did: the section tabs
 * (adaptive to tenant kind + plan — kind drives vocabulary, plan drives
 * capability), the org/space switcher, the exit up to the Huntima platform,
 * the language switch, the signed-in email, and sign out.
 *
 * Follows the same overlay contract as MapModal: it teleports to <body>, traps
 * page scroll while open, closes on Escape and on a backdrop click, and moves
 * focus to the close control so a screen reader lands inside the dialog.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { canBrand } from 'shared'
import AppIcon from '../AppIcon.vue'
import TeamMark from '../TeamMark.vue'
import HuntimaMark from '../HuntimaMark.vue'
import LocaleSwitcher from '../LocaleSwitcher.vue'
import { useSessionStore } from '../../stores/session'
import { useTenantStore } from '../../stores/tenant'
import { useOrgsStore } from '../../stores/orgs'

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const tenant = useTenantStore()
const orgs = useOrgsStore()

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

const switchLabelKey = computed(() => (isOrg.value ? 'hunts.navOrgs' : 'hunts.navSpaces'))

function isActive(name: string): boolean {
  return name === 'admin-hunts'
    ? String(route.name ?? '').startsWith('admin-hunt')
    : route.name === name
}

const closeButton = ref<HTMLButtonElement | null>(null)

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') emit('close')
}

let previousOverflow = ''

onMounted(() => {
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  window.addEventListener('keydown', onKeydown)
  closeButton.value?.focus()
})

onBeforeUnmount(() => {
  document.body.style.overflow = previousOverflow
  window.removeEventListener('keydown', onKeydown)
})

async function signOut(): Promise<void> {
  emit('close')
  await session.signOutAll()
  void router.push({ name: 'landing' })
}
</script>

<template>
  <Teleport to="body">
    <Transition name="nav-modal" appear>
      <div
        class="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 pb-safe pt-safe backdrop-blur-sm sm:items-center sm:justify-center"
        @click.self="emit('close')"
      >
        <div
          class="flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-card bg-surface shadow-xl sm:max-w-sm sm:rounded-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-nav-title"
        >
          <header class="flex items-center justify-between gap-2 border-b border-brand-100 px-4 py-3">
            <div id="admin-nav-title" class="flex min-w-0 items-center gap-2">
              <TeamMark />
              <span class="truncate text-sm font-bold text-brand-900" translate="no">
                {{ tenant.settings.teamName }}
              </span>
            </div>
            <button
              ref="closeButton"
              type="button"
              class="rounded-full p-1.5 text-muted transition-colors hover:bg-brand-50 hover:text-brand-900"
              :aria-label="t('common.close')"
              @click="emit('close')"
            >
              <AppIcon name="close" class="size-5" />
            </button>
          </header>

          <div class="flex-1 overflow-y-auto p-3">
            <!-- Section destinations for THIS org's console. -->
            <nav class="grid gap-1">
              <RouterLink
                v-for="tab in tabs"
                :key="tab.name"
                :to="{ name: tab.name }"
                class="rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors"
                :class="
                  isActive(tab.name) ? 'bg-brand-600 text-white' : 'text-brand-900 hover:bg-brand-50'
                "
                @click="emit('close')"
              >
                {{ t(tab.labelKey) }}
              </RouterLink>
            </nav>

            <div class="my-2 border-t border-brand-100" />

            <!-- Leaving this console: switch to another org/space, or exit up
                 to the Huntima platform. -->
            <nav class="grid gap-1">
              <RouterLink
                :to="{ name: 'orgs' }"
                class="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-brand-900 transition-colors hover:bg-brand-50"
                @click="emit('close')"
              >
                {{ t(switchLabelKey) }}
                <AppIcon name="chevronRight" class="size-4 shrink-0 text-muted" />
              </RouterLink>
              <RouterLink
                :to="{ name: 'platform-home' }"
                class="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-brand-900 transition-colors hover:bg-brand-50"
                @click="emit('close')"
              >
                <HuntimaMark class="size-5 shrink-0" />
                {{ t('hunts.navPlatform') }}
              </RouterLink>
            </nav>

            <div class="my-2 border-t border-brand-100" />

            <div class="flex items-center justify-between gap-2 px-3 py-2">
              <span class="text-xs font-semibold text-muted">{{ t('shell.localeLabel') }}</span>
              <LocaleSwitcher />
            </div>

            <div class="flex items-center justify-between gap-2 px-3 py-2">
              <p v-if="session.email" class="truncate text-xs text-muted" translate="no">
                {{ session.email }}
              </p>
              <button
                type="button"
                class="shrink-0 text-sm font-semibold text-red-600 transition-colors hover:text-red-700"
                @click="signOut"
              >
                {{ t('entry.signOut') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Component-local fade, matching MapModal — the panel and backdrop fade
   together on opacity only. Page-to-page View Transitions are the router's
   job; this is a local overlay. */
.nav-modal-enter-active,
.nav-modal-leave-active {
  transition: opacity 0.2s ease;
}
.nav-modal-enter-from,
.nav-modal-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .nav-modal-enter-active,
  .nav-modal-leave-active {
    transition: none;
  }
}
</style>
