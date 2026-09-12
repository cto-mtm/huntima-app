<script setup lang="ts">
/**
 * The front door. Every session starts here.
 *
 * Two audiences with opposite needs meet on this screen: a family that must
 * be playing within seconds and no friction is acceptable, and stadium staff
 * who must be authenticated because they can change what the whole building
 * sees. Hence guest-first layout with staff sign-in deliberately secondary.
 */
import { computed, defineAsyncComponent, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import BaseButton from '../components/BaseButton.vue'
import { useProgressStore } from '../stores/progress'
import { useSessionStore } from '../stores/session'
import { useTenantStore } from '../stores/tenant'
import { IS_LOCAL_API } from '../lib/api'

const { t } = useI18n()
const router = useRouter()
const session = useSessionStore()
const progress = useProgressStore()
const tenant = useTenantStore()

const returning = computed(() => progress.hasProfile)

// Dev persona shortcuts live here rather than in a floating overlay: this is
// the screen where a person is already deciding who to be.
const DevPersonaPicker = import.meta.env.DEV
  ? defineAsyncComponent(() => import('../dev/DevPersonaPicker.vue'))
  : null
const showDevTools = import.meta.env.DEV && IS_LOCAL_API

const shortDeviceId = computed(() => session.deviceId.slice(0, 8))

function playAsGuest(): void {
  session.continueAsGuest()
  // A returning fan keeps their badges and goes straight in; a new one picks
  // a name first.
  void router.push(returning.value ? { name: 'home' } : { name: 'onboarding' })
}

function startOver(): void {
  progress.reset()
  session.continueAsGuest()
  void router.push({ name: 'onboarding' })
}

const busy = ref(false)
</script>

<template>
  <!--
    Layout intent: this screen is seen almost entirely by families, and the
    one thing they must do is obvious and large. Staff sign-in is a quiet
    footer link on purpose — staff already know to look for it, and giving
    it equal visual weight suggests to a parent that they might need it.
  -->
  <section class="mx-auto flex min-h-dvh max-w-md flex-col px-5 py-10">
    <div class="flex flex-1 flex-col justify-center">
      <div class="text-center">
        <p class="text-4xl" aria-hidden="true">{{ tenant.settings.avatars[0] }}</p>
        <h1 class="mt-3 text-3xl font-extrabold text-brand-900">{{ tenant.settings.teamName }}</h1>
        <p class="mt-1 text-sm text-muted">{{ t('entry.subtitle') }}</p>
      </div>

      <div class="mt-10 rounded-card bg-surface p-5 shadow-sm ring-1 ring-brand-100">
        <h2 class="text-sm font-bold uppercase tracking-wide text-brand-900">
          {{ t('entry.guestHeading') }}
        </h2>

        <div class="mt-3">
          <BaseButton size="lg" :disabled="busy" @click="playAsGuest">
            {{
              returning
                ? t('entry.continueAs', { nickname: progress.nickname })
                : t('entry.continueAsGuest')
            }}
          </BaseButton>
        </div>

        <p class="mt-2 text-center text-xs text-muted">{{ t('entry.guestHelp') }}</p>

        <button
          v-if="returning"
          type="button"
          class="mt-3 w-full text-center text-xs font-semibold text-brand-600"
          @click="startOver"
        >
          {{ t('entry.startOver') }}
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
      <p class="mt-2 font-mono text-[10px] text-muted/60">
        {{ t('entry.deviceLabel') }} {{ shortDeviceId }}
      </p>
    </footer>
  </section>
</template>
