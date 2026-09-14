<script setup lang="ts">
/**
 * The organizer door.
 *
 * It used to be a staff-only sign-in: email and password, and an account with
 * no org was signed back out with "that is not a staff account". That made the
 * one link on the marketing page labelled for organizers the one place an
 * organizer could not become one. Since `POST /orgs` is self-serve, this is a
 * front door, not a gate: it offers Google, sign-up and a password reset, and
 * an account with no orgs lands on the org picker, where it can create one.
 *
 * There is no separate organizer *account*. Running an org is a membership
 * document on an ordinary account (docs/platform-migration.md D3), so this
 * page and the fan sign-in authenticate exactly the same thing and differ only
 * in where they send you afterwards.
 */
import { computed, defineAsyncComponent, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import BaseButton from '../components/BaseButton.vue'
import GoogleButton from '../components/GoogleButton.vue'
import LocaleSwitcher from '../components/LocaleSwitcher.vue'
import { useSessionStore } from '../stores/session'
import { useOrgsStore } from '../stores/orgs'
import { safeInternalPath } from '../lib/redirect'
import { IS_LOCAL_API } from '../lib/api'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const orgs = useOrgsStore()

/**
 * Deep links carry their destination: someone who opened
 * /:slug/admin/hunts signed-out must land back there, not on the org picker.
 * The `?to=` is attacker-writable; safeInternalPath is the one gate.
 */
function destination(): string | null {
  return safeInternalPath(route.query.to)
}

const mode = ref<'signin' | 'signup'>('signin')
const email = ref('')
const password = ref('')
const submitted = ref(false)
const resetSent = ref(false)
/** Both the submit handlers and the already-signed-in watcher route onward,
 *  and a successful sign-in trips both. Route once. */
const proceeding = ref(false)

const DevAdminSeeder = import.meta.env.DEV
  ? defineAsyncComponent(() => import('../dev/DevAdminSeeder.vue'))
  : null
const showDevTools = import.meta.env.DEV && IS_LOCAL_API

const title = computed(() =>
  mode.value === 'signup' ? t('entry.organizerSignUpTitle') : t('entry.organizerTitle'),
)

/**
 * Sign-in failures collapse to one message so the form never reveals which
 * addresses have accounts. Sign-UP is different: "that email is taken" is
 * already knowable by anyone who tries, and withholding it just strands
 * someone on a form that will never succeed.
 */
const errorMessage = computed(() => {
  const code = session.authError
  if (!code) return null
  // A network failure is not a credential failure. Saying so saves someone
  // retyping a correct password while the emulator is simply unreachable.
  if (code === 'auth/network-request-failed') return t('entry.signInUnavailable')
  if (code === 'auth/email-already-in-use') return t('entry.emailInUse')
  if (code === 'auth/weak-password') return t('entry.passwordTooShort')
  return t('entry.signInFailed')
})

/**
 * Waits for the auth listener to settle the role after a successful sign-in.
 * Signing in resolves before the session is settled, and every decision below
 * depends on the settled one.
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

/**
 * Where an authenticated account goes from here.
 *
 * Operators pass every gate. Everyone else is routed by what they can actually
 * open: a carried deep link only if they have an org to open it with, else the
 * picker, which is also the create-an-org screen. An account with none is then
 * one screen away from having one instead of being ejected.
 */
async function proceed(): Promise<void> {
  const dest = destination()
  if (session.isAdmin) {
    void router.push(dest ?? { name: 'orgs' })
    return
  }

  // ensureLoaded, not load: the picker this usually lands on asks for the
  // same list on mount, and signing in should cost one request, not two.
  await orgs.ensureLoaded()
  void router.push(orgs.orgs.length && dest ? dest : { name: 'orgs' })
}

async function afterAuth(): Promise<void> {
  if (proceeding.value) return
  proceeding.value = true
  await session.ensureAuthReady()
  await waitForRole()
  await proceed()
}

async function submit(): Promise<void> {
  submitted.value = true
  resetSent.value = false

  const ok =
    mode.value === 'signup'
      ? await session.createAccount(email.value.trim(), password.value)
      : await session.signInWithEmail(email.value.trim(), password.value)

  if (!ok) {
    password.value = ''
    return
  }
  await afterAuth()
}

async function google(): Promise<void> {
  submitted.value = true
  resetSent.value = false
  if (await session.signInWithGoogle()) await afterAuth()
}

async function resetPassword(): Promise<void> {
  submitted.value = true
  const address = email.value.trim()
  if (!address) return
  // Reports sent whatever the outcome. See session.sendPasswordReset.
  resetSent.value = await session.sendPasswordReset(address)
}

// Someone already signed in who revisits this page skips the form.
watch(
  () => session.user,
  (user) => {
    if (user) void afterAuth()
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
    <h1 class="text-2xl font-extrabold text-brand-900">{{ title }}</h1>
    <p class="mt-1 text-sm text-muted">{{ t('entry.organizerSubtitle') }}</p>

    <div class="mt-6">
      <GoogleButton :label="t('entry.signInGoogle')" :disabled="session.busy" @click="google" />
    </div>

    <form class="mt-5 space-y-4" @submit.prevent="submit">
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
          :autocomplete="mode === 'signup' ? 'new-password' : 'current-password'"
          required
          minlength="6"
          class="mt-1.5 w-full rounded-xl border border-brand-200 bg-surface px-4 py-3 text-base outline-none focus:border-brand-500"
        />
      </div>

      <p v-if="submitted && errorMessage" class="text-sm font-medium text-red-600">
        {{ errorMessage }}
      </p>
      <p v-else-if="resetSent" class="text-sm font-medium text-green-700">
        {{ t('entry.resetSent') }}
      </p>

      <BaseButton type="submit" size="lg" :disabled="session.busy">
        {{
          session.busy
            ? t('entry.signingIn')
            : mode === 'signup'
              ? t('entry.createAccount')
              : t('entry.signIn')
        }}
      </BaseButton>
    </form>

    <!-- Reset needs the address above and nothing else, so it sits under the
         form rather than on a screen of its own. -->
    <button
      v-if="mode === 'signin'"
      type="button"
      class="mt-3 text-center text-xs font-semibold text-brand-600 disabled:opacity-60"
      :disabled="session.busy || !email.trim()"
      @click="resetPassword"
    >
      {{ t('entry.forgotPassword') }}
    </button>

    <p class="mt-5 text-center text-sm text-muted">
      {{ mode === 'signup' ? t('entry.haveAccount') : t('entry.organizerNewHere') }}
      <button
        type="button"
        class="ml-1 font-semibold text-brand-600"
        @click="mode = mode === 'signup' ? 'signin' : 'signup'"
      >
        {{ mode === 'signup' ? t('entry.toggleToSignIn') : t('entry.toggleToSignUp') }}
      </button>
    </p>

    <component :is="DevAdminSeeder" v-if="showDevTools && DevAdminSeeder" class="mt-6" @filled="fillDemo" />

    <button
      type="button"
      class="mt-6 text-center text-sm font-semibold text-brand-600"
      @click="router.push('/')"
    >
      {{ t('entry.backToEntry') }}
    </button>

    <div class="mt-8 flex justify-center">
      <LocaleSwitcher variant="expanded" />
    </div>
  </section>
</template>
