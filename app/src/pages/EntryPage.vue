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
import { computed, defineAsyncComponent, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import BaseButton from '../components/BaseButton.vue'
import GoogleButton from '../components/GoogleButton.vue'
import TeamMark from '../components/TeamMark.vue'
import LocaleSwitcher from '../components/LocaleSwitcher.vue'
import { useProgressStore } from '../stores/progress'
import { useSessionStore } from '../stores/session'
import { useTenantStore } from '../stores/tenant'
import { IS_LOCAL_API } from '../lib/api'

const { t } = useI18n()
const router = useRouter()
const progress = useProgressStore()
const session = useSessionStore()
const tenant = useTenantStore()

// Starts empty, not prefilled from progress.nickname: this screen begins a
// fresh session, and prefilling would resurface a stale name (e.g. one left
// by a dev persona) that the fan never chose.
const guestName = ref('')

const DevPersonaPicker = import.meta.env.DEV
  ? defineAsyncComponent(() => import('../dev/DevPersonaPicker.vue'))
  : null
const showDevTools = import.meta.env.DEV && IS_LOCAL_API

const shortDeviceId = computed(() => session.deviceId.slice(0, 8))

function playAsGuest(): void {
  // Name is optional. setProfile trims it, and a blank value clears any
  // stale nickname so useFanName falls back to the translated "Guest" —
  // never leaving a previous session's name on this device. Keep whatever
  // avatar was already chosen.
  progress.setProfile(guestName.value, progress.avatarId)
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

        <!-- Google first: an account is what keeps a name and (in time) a
             trophy case across visits, so it is the option worth taking. -->
        <div class="mt-3">
          <GoogleButton
            :label="t('entry.signInGoogle')"
            :disabled="session.busy"
            @click="withGoogle"
          />
        </div>
        <p class="mt-2 text-center text-xs text-muted">{{ t('entry.accountHelp') }}</p>

        <div class="my-4 flex items-center gap-3" aria-hidden="true">
          <span class="h-px flex-1 bg-brand-100" />
          <!-- translate="no": rendered uppercase, "OR" is also the French word
               for "gold", so Chrome's content sniffer flags the page as French
               and offers to translate it (turning this into "GOLD"). It is
               decorative chrome, not content, so opt it out of translation. -->
          <span class="text-[11px] font-semibold uppercase text-muted" translate="no">{{ t('entry.or') }}</span>
          <span class="h-px flex-1 bg-brand-100" />
        </div>

        <!-- Guest picks a name here if they want one; it is optional so a
             family at a turnstile is never blocked behind a field they did
             not ask for. Blank means "stay a guest". -->
        <label for="guest-name" class="block text-sm font-semibold text-brand-900">
          {{ t('entry.guestNameLabel') }}
        </label>
        <input
          id="guest-name"
          v-model="guestName"
          type="text"
          maxlength="20"
          autocomplete="nickname"
          :placeholder="t('entry.guestNamePlaceholder')"
          :disabled="session.busy"
          class="mb-3 mt-1.5 w-full rounded-xl border border-brand-200 bg-surface px-4 py-3 text-base outline-none focus:border-brand-500"
          @keyup.enter="playAsGuest"
        />

        <!-- Guest stays one tap away. A family at a turnstile must never be
             blocked behind a sign-in they did not ask for. -->
        <BaseButton variant="secondary" size="lg" :disabled="session.busy" @click="playAsGuest">
          {{ t('entry.continueAsGuest') }}
        </BaseButton>
        <p class="mt-2 text-center text-xs text-muted">{{ t('entry.guestHint') }}</p>

        <button
          type="button"
          class="mt-3 w-full text-center text-xs font-semibold text-brand-600"
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
