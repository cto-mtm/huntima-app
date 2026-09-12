<script setup lang="ts">
/**
 * The front door. Every session starts here.
 *
 * Three audiences with different needs meet on this screen: a family that
 * must be playing within seconds, a returning fan who wants their name back,
 * and staff who must authenticate because they can change what the whole
 * building sees. Guest is the primary path and costs one tap — no name, no
 * account, nothing to read. Naming yourself happens later, from the profile
 * screen, once you care.
 */
import { computed, defineAsyncComponent } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import BaseButton from '../components/BaseButton.vue'
import TeamMark from '../components/TeamMark.vue'
import LocaleSwitcher from '../components/LocaleSwitcher.vue'
import { useSessionStore } from '../stores/session'
import { useTenantStore } from '../stores/tenant'
import { IS_LOCAL_API } from '../lib/api'

const { t } = useI18n()
const router = useRouter()
const session = useSessionStore()
const tenant = useTenantStore()

const DevPersonaPicker = import.meta.env.DEV
  ? defineAsyncComponent(() => import('../dev/DevPersonaPicker.vue'))
  : null
const showDevTools = import.meta.env.DEV && IS_LOCAL_API

const shortDeviceId = computed(() => session.deviceId.slice(0, 8))

function playAsGuest(): void {
  session.continueAsGuest()
  void router.push({ name: 'home' })
}

async function withGoogle(): Promise<void> {
  if (await session.signInWithGoogle()) void router.push({ name: 'home' })
}
</script>

<template>
  <!--
    Layout intent: this screen is seen almost entirely by families, and the
    one thing they must do is obvious and large. Staff sign-in is a quiet
    footer link on purpose — staff already know to look for it, and giving it
    equal visual weight suggests to a parent that they might need it.
  -->
  <section class="mx-auto flex min-h-dvh max-w-md flex-col px-5 py-10">
    <!-- First thing on the page, and first in the tab order: someone who
         cannot read this screen needs to fix that before anything else. -->
    <div class="flex justify-end">
      <LocaleSwitcher variant="expanded" />
    </div>

    <div class="flex flex-1 flex-col justify-center">
      <div class="text-center">
        <div class="flex justify-center">
          <TeamMark size="lg" />
        </div>
        <h1 class="mt-3 text-3xl font-extrabold text-brand-900" translate="no">
          {{ tenant.settings.teamName }}
        </h1>
        <p class="mt-1 text-sm text-muted">{{ t('entry.subtitle') }}</p>
      </div>

      <div class="mt-10 rounded-card bg-surface p-5 shadow-sm ring-1 ring-brand-100">
        <h2 class="text-sm font-bold uppercase tracking-wide text-brand-900">
          {{ t('entry.guestHeading') }}
        </h2>

        <div class="mt-3">
          <BaseButton size="lg" :disabled="session.busy" @click="playAsGuest">
            {{ t('entry.continueAsGuest') }}
          </BaseButton>
        </div>
        <p class="mt-2 text-center text-xs text-muted">{{ t('entry.guestHint') }}</p>
      </div>

      <!-- Accounts are optional and secondary: they buy a name that survives
           between visits, not access. -->
      <div class="mt-4 rounded-card border border-dashed border-brand-200 p-4">
        <h2 class="text-sm font-bold uppercase tracking-wide text-brand-900">
          {{ t('entry.accountHeading') }}
        </h2>
        <p class="mt-1 text-xs text-muted">{{ t('entry.accountHelp') }}</p>

        <div class="mt-3">
          <BaseButton variant="secondary" size="lg" :disabled="session.busy" @click="withGoogle">
            {{ t('entry.signInGoogle') }}
          </BaseButton>
        </div>

        <button
          type="button"
          class="mt-2 w-full text-center text-xs font-semibold text-brand-600"
          @click="router.push({ name: 'signin' })"
        >
          {{ t('entry.signInEmail') }}
        </button>
      </div>

      <component :is="DevPersonaPicker" v-if="showDevTools && DevPersonaPicker" class="mt-4" />
    </div>

    <footer class="pt-10 text-center">
      <RouterLink
        :to="{ name: 'staff-login' }"
        class="text-xs text-muted underline-offset-4 hover:underline"
      >
        {{ t('entry.staffSignIn') }}
      </RouterLink>
      <p class="mt-2 font-mono text-[10px] text-muted/60" translate="no">
        {{ t('entry.deviceLabel') }} {{ shortDeviceId }}
      </p>
    </footer>
  </section>
</template>
