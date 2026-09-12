<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import BaseButton from '../components/BaseButton.vue'
import LocaleSwitcher from '../components/LocaleSwitcher.vue'
import { NOT_STAFF, useSessionStore } from '../stores/session'
import { IS_LOCAL_API } from '../lib/api'

const { t } = useI18n()
const router = useRouter()
const session = useSessionStore()

const email = ref('')
const password = ref('')
const submitted = ref(false)

const DevAdminSeeder = import.meta.env.DEV
  ? defineAsyncComponent(() => import('../dev/DevAdminSeeder.vue'))
  : null
const showDevTools = import.meta.env.DEV && IS_LOCAL_API

// One generic message regardless of the Firebase error code: distinguishing
// "no such account" from "wrong password" tells an attacker which emails are
// real. The exception is the not-staff case, which is a different problem and
// would otherwise read as a typo'd password.
const errorMessage = computed(() => {
  const code = session.authError
  if (!code) return null
  if (code === NOT_STAFF) return t('entry.notStaff')
  // A network failure is not a credential failure. Saying so saves someone
  // retyping a correct password while the emulator is simply unreachable.
  if (code === 'auth/network-request-failed') return t('entry.signInUnavailable')
  return t('entry.signInFailed')
})

/**
 * Waits for the auth listener to settle the role after a successful sign-in.
 * Signing in is not the same as being staff: fans can sign in now too, and
 * the claim is what decides.
 */
function waitForRole(timeoutMs = 6000): Promise<void> {
  if (session.isAdmin || session.isFan) return Promise.resolve()
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      stop()
      resolve()
    }, timeoutMs)
    const stop = watch(
      () => session.role,
      (role) => {
        if (role !== 'admin' && role !== 'fan') return
        clearTimeout(timer)
        stop()
        resolve()
      },
    )
  })
}

async function submit(): Promise<void> {
  submitted.value = true

  const ok = await session.signInWithEmail(email.value.trim(), password.value)
  if (!ok) {
    password.value = ''
    return
  }

  await session.ensureAuthReady()
  await waitForRole()

  // A real account without the claim is a FAN, and must not be left holding
  // a half-open staff session just because they used the wrong form.
  if (!session.isAdmin) {
    await session.signOutAll()
    session.authError = NOT_STAFF
    password.value = ''
  }
}

// Navigate only once the verified claim has actually granted the role.
watch(
  () => session.isAdmin,
  (isAdmin) => {
    if (isAdmin) void router.push({ name: 'admin-hunts' })
  },
  { immediate: true },
)

function fillDemo(demo: { email: string; password: string }): void {
  email.value = demo.email
  password.value = demo.password
}
</script>

<template>
  <section class="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
    <div class="mb-6 flex justify-end">
      <LocaleSwitcher variant="expanded" />
    </div>

    <h1 class="text-2xl font-extrabold text-brand-900">{{ t('entry.loginTitle') }}</h1>
    <p class="mt-1 text-sm text-muted">{{ t('entry.loginSubtitle') }}</p>

    <form class="mt-6 space-y-4" @submit.prevent="submit">
      <div>
        <label for="staff-email" class="block text-sm font-semibold text-brand-900">
          {{ t('entry.emailLabel') }}
        </label>
        <input
          id="staff-email"
          v-model="email"
          type="email"
          autocomplete="username"
          required
          class="mt-1.5 w-full rounded-xl border border-brand-200 bg-surface px-4 py-3 text-base outline-none focus:border-brand-500"
        />
      </div>

      <div>
        <label for="staff-password" class="block text-sm font-semibold text-brand-900">
          {{ t('entry.passwordLabel') }}
        </label>
        <input
          id="staff-password"
          v-model="password"
          type="password"
          autocomplete="current-password"
          required
          class="mt-1.5 w-full rounded-xl border border-brand-200 bg-surface px-4 py-3 text-base outline-none focus:border-brand-500"
        />
      </div>

      <p v-if="submitted && errorMessage" class="text-sm font-medium text-red-600">
        {{ errorMessage }}
      </p>

      <BaseButton type="submit" size="lg" :disabled="session.busy">
        {{ session.busy ? t('entry.signingIn') : t('entry.signIn') }}
      </BaseButton>
    </form>

    <component :is="DevAdminSeeder" v-if="showDevTools && DevAdminSeeder" class="mt-6" @filled="fillDemo" />

    <button
      type="button"
      class="mt-6 text-center text-sm font-semibold text-brand-600"
      @click="router.push({ name: 'entry' })"
    >
      {{ t('entry.backToEntry') }}
    </button>
  </section>
</template>
