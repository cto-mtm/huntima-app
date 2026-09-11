<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import BaseButton from '../components/BaseButton.vue'
import { useTenantStore } from '../stores/tenant'
import { useProgressStore } from '../stores/progress'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const progress = useProgressStore()
const tenant = useTenantStore()

const nickname = ref(progress.nickname)
const avatar = ref(progress.avatar)
const touched = ref(false)

const isValid = computed(() => nickname.value.trim().length >= 2)
const showError = computed(() => touched.value && !isValid.value)

function submit(): void {
  touched.value = true
  if (!isValid.value) return

  progress.setProfile(nickname.value, avatar.value)

  // The router guard stashes where the fan was headed before we
  // interrupted them — a QR code can drop someone on any route.
  const next = typeof route.query.next === 'string' ? route.query.next : '/'
  void router.replace(next)
}
</script>

<template>
  <section class="py-6">
    <h1 class="text-2xl font-extrabold text-brand-900">{{ t('onboarding.title') }}</h1>
    <p class="mt-1 text-sm text-muted">{{ t('onboarding.subtitle') }}</p>

    <form class="mt-6 space-y-6" @submit.prevent="submit">
      <div>
        <label for="nickname" class="block text-sm font-semibold text-brand-900">
          {{ t('onboarding.nicknameLabel') }}
        </label>
        <input
          id="nickname"
          v-model="nickname"
          type="text"
          autocomplete="off"
          maxlength="20"
          :placeholder="t('onboarding.nicknamePlaceholder')"
          class="mt-1.5 w-full rounded-xl border border-brand-200 bg-surface px-4 py-3 text-base outline-none focus:border-brand-500"
          @blur="touched = true"
        />
        <p v-if="showError" class="mt-1.5 text-xs font-medium text-red-600">
          {{ t('onboarding.nicknameTooShort') }}
        </p>
      </div>

      <fieldset>
        <legend class="block text-sm font-semibold text-brand-900">
          {{ t('onboarding.avatarLabel') }}
        </legend>
        <div class="mt-2 grid grid-cols-6 gap-2">
          <button
            v-for="option in tenant.settings.avatars"
            :key="option"
            type="button"
            class="flex aspect-square items-center justify-center rounded-xl border-2 text-2xl"
            :class="option === avatar ? 'border-brand-500 bg-brand-50' : 'border-brand-100 bg-surface'"
            :aria-pressed="option === avatar"
            @click="avatar = option"
          >
            {{ option }}
          </button>
        </div>
      </fieldset>

      <BaseButton type="submit" size="lg">{{ t('onboarding.start') }}</BaseButton>

      <p class="text-center text-xs text-muted">{{ t('onboarding.privacyNote') }}</p>
    </form>
  </section>
</template>
