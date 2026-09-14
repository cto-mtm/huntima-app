<script setup lang="ts">
/**
 * Where you go to run something. Two doors, deliberately unequal in size.
 *
 * STARTING A HUNT is the common case and comes first: one field, no
 * organization, no address to negotiate. A wedding host, a teacher, someone
 * planning a birthday party — none of them are founding an institution, and
 * making them create one before typing a mission was the confusion this page
 * now exists to remove.
 *
 * CREATING AN ORGANIZATION is the rarer, deliberate case, folded away at the
 * bottom: a club, company or venue that wants its own name in the URL, its
 * own branding and a team of staff. That is also the surface a plan will
 * eventually attach to, which is another reason it is not the default path.
 *
 * The list in between is whatever this account can already open. Operators
 * see every org on the platform, which is why the heading is scoped rather
 * than possessive.
 */
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { ref } from 'vue'
import BaseButton from '../components/BaseButton.vue'
import CreateHuntForm from '../components/CreateHuntForm.vue'
import CreateOrgForm from '../components/CreateOrgForm.vue'
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
  // The store clears itself on sign-out and refreshes itself after a create,
  // so a cached list here is a current one.
  await orgs.ensureLoaded()
})

function openConsole(slug: string): void {
  void router.push({ name: 'admin-hunts', params: { tenantSlug: slug } })
}

function viewFanPage(slug: string): void {
  void router.push({ name: 'home', params: { tenantSlug: slug } })
}

/** The organization form stays folded until asked for. Most people never
 *  open it, and an empty branded-page form is not a welcome. */
const showOrgForm = ref(false)

async function signOut(): Promise<void> {
  await session.signOutAll()
  void router.replace({ name: 'landing' })
}
</script>

<template>
  <section class="mx-auto flex min-h-dvh max-w-md flex-col px-5 py-10">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-extrabold text-brand-900">{{ t('orgs.runTitle') }}</h1>
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
      <!-- ── Start a hunt: the common case, first and largest ────── -->
      <div class="mt-6 rounded-card bg-surface p-4 shadow-sm ring-1 ring-brand-100">
        <h2 class="text-sm font-bold uppercase tracking-wide text-brand-900">
          {{ t('orgs.startHuntHeading') }}
        </h2>
        <p class="mt-0.5 mb-3 text-xs text-muted">{{ t('orgs.startHuntIntro') }}</p>
        <CreateHuntForm />
      </div>

      <h2
        v-if="orgs.orgs.length"
        class="mt-8 text-sm font-bold uppercase tracking-wide text-brand-900"
      >
        {{ t('orgs.openHeading') }}
      </h2>
      <ul v-if="orgs.orgs.length" class="mt-3 grid gap-2.5">
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
              {{ org.kind === 'personal' ? t('orgs.yoursLabel') : t(`orgs.role.${org.role}`) }}
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

      <!-- ── Create an organization: rarer, deliberate, folded away ─ -->
      <div class="mt-8 border-t border-brand-100 pt-6">
        <button
          v-if="!showOrgForm"
          type="button"
          class="text-sm font-semibold text-brand-600"
          @click="showOrgForm = true"
        >
          {{ t('orgs.createPrompt') }}
        </button>

        <div v-else class="rounded-card bg-surface p-4 shadow-sm ring-1 ring-brand-100">
          <h2 class="text-sm font-bold uppercase tracking-wide text-brand-900">
            {{ t('orgs.createHeading') }}
          </h2>
          <p class="mt-0.5 mb-3 text-xs text-muted">{{ t('orgs.createIntro') }}</p>
          <CreateOrgForm />
        </div>
      </div>
    </template>

    <footer class="mt-auto flex items-center justify-between gap-3 pt-10">
      <RouterLink :to="{ name: 'platform-home' }" class="text-sm font-semibold text-brand-600">
        {{ t('orgs.platformHome') }}
      </RouterLink>
      <button type="button" class="text-sm font-semibold text-brand-600" @click="signOut">
        {{ t('entry.signOut') }}
      </button>
    </footer>
  </section>
</template>
