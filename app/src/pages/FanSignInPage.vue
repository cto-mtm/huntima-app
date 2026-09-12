<script setup lang="ts">
/**
 * Fan sign-in and sign-up: Google, or email and password.
 *
 * Entirely optional — guests play without any of this. An account exists so a
 * name follows you between visits, which is why it is offered here and on the
 * profile screen rather than blocking the way in.
 */
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import BaseButton from '../components/BaseButton.vue'
import LocaleSwitcher from '../components/LocaleSwitcher.vue'
import { useSessionStore } from '../stores/session'

const { t } = useI18n()
const router = useRouter()
const session = useSessionStore()

const mode = ref<'signin' | 'signup'>('signin')
const email = ref('')
const password = ref('')
const submitted = ref(false)

const title = computed(() =>
  mode.value === 'signup' ? t('entry.fanSignUpTitle') : t('entry.fanSignInTitle'),
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
  if (code === 'auth/network-request-failed') return t('entry.signInUnavailable')
  if (code === 'auth/email-already-in-use') return t('entry.emailInUse')
  if (code === 'auth/weak-password') return t('entry.passwordTooShort')
  return t('entry.signInFailed')
})

async function submit(): Promise<void> {
  submitted.value = true
  const ok =
    mode.value === 'signup'
      ? await session.createAccount(email.value.trim(), password.value)
      : await session.signInWithEmail(email.value.trim(), password.value)
  if (!ok) password.value = ''
}

async function google(): Promise<void> {
  submitted.value = true
  await session.signInWithGoogle()
}

// Navigate only once the auth listener has actually granted the role —
// signing in resolves before the session is settled.
watch(
  () => session.isFan,
  (isFan) => {
    if (isFan) void router.push({ name: 'home' })
  },
  { immediate: true },
)
</script>

<template>
  <section class="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
    <div class="mb-6 flex justify-end">
      <LocaleSwitcher variant="expanded" />
    </div>

    <h1 class="text-2xl font-extrabold text-brand-900">{{ title }}</h1>
    <p class="mt-1 text-sm text-muted">{{ t('entry.accountHelp') }}</p>

    <div class="mt-6">
      <BaseButton size="lg" variant="secondary" :disabled="session.busy" @click="google">
        {{ t('entry.signInGoogle') }}
      </BaseButton>
    </div>

    <form class="mt-5 space-y-4" @submit.prevent="submit">
      <div>
        <label for="fan-email" class="block text-sm font-semibold text-brand-900">
          {{ t('entry.emailLabel') }}
        </label>
        <input
          id="fan-email"
          v-model="email"
          type="email"
          autocomplete="username"
          required
          class="mt-1.5 w-full rounded-xl border border-brand-200 bg-surface px-4 py-3 text-base outline-none focus:border-brand-500"
        />
      </div>

      <div>
        <label for="fan-password" class="block text-sm font-semibold text-brand-900">
          {{ t('entry.passwordLabel') }}
        </label>
        <input
          id="fan-password"
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

    <p class="mt-5 text-center text-sm text-muted">
      {{ mode === 'signup' ? t('entry.haveAccount') : t('entry.accountHeading') }}
      <button
        type="button"
        class="ml-1 font-semibold text-brand-600"
        @click="mode = mode === 'signup' ? 'signin' : 'signup'"
      >
        {{ mode === 'signup' ? t('entry.toggleToSignIn') : t('entry.toggleToSignUp') }}
      </button>
    </p>

    <button
      type="button"
      class="mt-6 text-center text-sm font-semibold text-brand-600"
      @click="router.push({ name: 'entry' })"
    >
      {{ t('entry.backToEntry') }}
    </button>
  </section>
</template>
