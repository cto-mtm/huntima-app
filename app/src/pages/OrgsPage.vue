<script setup lang="ts">
/**
 * The org picker: which console does this account open?
 *
 * One account can run several orgs (and operators see every org), so signing
 * in lands here rather than on a hardcoded dashboard. Members of exactly one
 * org still pass through — a taplist of one beats a surprise redirect that
 * hides where "switch organization" lives.
 */
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import BaseButton from '../components/BaseButton.vue'
import LocaleSwitcher from '../components/LocaleSwitcher.vue'
import { useOrgsStore } from '../stores/orgs'
import { useSessionStore } from '../stores/session'

const { t } = useI18n()
const router = useRouter()
const session = useSessionStore()
const orgs = useOrgsStore()

onMounted(async () => {
  await session.ensureAuthReady()
  if (!session.user) {
    void router.replace({ name: 'staff-login' })
    return
  }
  await orgs.load()
})

function openConsole(slug: string): void {
  void router.push({ name: 'admin-hunts', params: { tenantSlug: slug } })
}

function viewFanPage(slug: string): void {
  void router.push({ name: 'home', params: { tenantSlug: slug } })
}

async function signOut(): Promise<void> {
  await session.signOutAll()
  void router.replace({ name: 'staff-login' })
}
</script>

<template>
  <section class="mx-auto flex min-h-dvh max-w-md flex-col px-5 py-10">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-extrabold text-brand-900">{{ t('orgs.title') }}</h1>
        <p v-if="session.email" class="mt-0.5 text-xs text-muted" translate="no">
          {{ t('entry.signedInAs', { email: session.email }) }}
        </p>
      </div>
      <LocaleSwitcher />
    </div>

<!-- Gate on `loaded`, not just `loading`: while ensureAuthReady is still
         pending on a hard reload, neither flag is set — and that beat must
         read as loading, never as "you have no organizations". -->
    <p v-if="orgs.loading || (!orgs.loaded && !orgs.error)" class="mt-8 text-sm text-muted">
      {{ t('common.loading') }}
    </p>

    <p
      v-else-if="orgs.error"
      class="mt-8 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
    >
      {{ t('orgs.loadFailed') }}
    </p>

    <template v-else>
      <ul v-if="orgs.orgs.length" class="mt-6 grid gap-2.5">
        <li
          v-for="org in orgs.orgs"
          :key="org.slug"
          class="rounded-card bg-surface p-4 shadow-sm ring-1 ring-brand-100"
        >
          <div class="flex items-center justify-between gap-2">
            <div class="min-w-0">
              <h2 class="truncate font-semibold text-brand-900" translate="no">
                {{ org.teamName }}
              </h2>
              <p class="font-mono text-[11px] text-muted" translate="no">/{{ org.slug }}</p>
            </div>
            <span
              class="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold uppercase text-brand-600"
            >
              {{ t(`orgs.role.${org.role}`) }}
            </span>
          </div>
          <div class="mt-3 flex flex-wrap gap-2">
            <BaseButton @click="openConsole(org.slug)">{{ t('orgs.open') }}</BaseButton>
            <BaseButton variant="ghost" @click="viewFanPage(org.slug)">
              {{ t('orgs.view') }}
            </BaseButton>
          </div>
        </li>
      </ul>

      <div v-else class="mt-10 text-center">
        <p class="text-sm text-muted">{{ t('orgs.empty') }}</p>
      </div>
    </template>

    <footer class="mt-auto pt-10 text-center">
      <button type="button" class="text-sm font-semibold text-brand-600" @click="signOut">
        {{ t('entry.signOut') }}
      </button>
    </footer>
  </section>
</template>
