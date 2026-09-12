<script setup lang="ts">
/**
 * Where a fan names themselves — replacing the old onboarding step.
 *
 * Naming yourself is now something you do once you care, not a toll gate
 * between scanning a QR code and playing. The product brief asked for the
 * smallest possible onboarding, and a required text field in front of a
 * ten-year-old at a turnstile is the opposite of that.
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import BaseButton from '../components/BaseButton.vue'
import FanAvatar from '../components/FanAvatar.vue'
import { useFanName } from '../composables/useFanName'
import { useProgressStore } from '../stores/progress'
import { useSessionStore } from '../stores/session'
import { useTenantStore } from '../stores/tenant'

const { t } = useI18n()
const router = useRouter()
const progress = useProgressStore()
const session = useSessionStore()
const tenant = useTenantStore()
const { displayName } = useFanName()

const name = ref(progress.nickname)
const avatarId = ref<string | null>(progress.avatarId)
const savedAt = ref<number | null>(null)

const hasAvatars = computed(() => tenant.settings.avatars.length > 0)
const dirty = computed(() => name.value !== progress.nickname || avatarId.value !== progress.avatarId)

function save(): void {
  // Blank is a valid choice, not a validation failure: it means "stay a
  // guest", and useFanName falls back to the translated "Guest".
  progress.setProfile(name.value, avatarId.value)
  savedAt.value = Date.now()
}

async function signOut(): Promise<void> {
  await session.signOutAll()
  void router.push({ name: 'entry' })
}
</script>

<template>
  <section class="py-5">
    <header class="flex items-center gap-3">
      <FanAvatar size="lg" />
      <div class="min-w-0">
        <h1 class="truncate text-2xl font-extrabold text-brand-900" translate="no">
          {{ displayName }}
        </h1>
        <p class="text-sm text-muted">{{ t('profile.subtitle') }}</p>
      </div>
    </header>

    <div class="mt-6 space-y-5">
      <div>
        <label for="display-name" class="block text-sm font-semibold text-brand-900">
          {{ t('profile.nameLabel') }}
        </label>
        <p class="mt-0.5 text-xs text-muted">{{ t('profile.nameHelp') }}</p>
        <input
          id="display-name"
          v-model="name"
          type="text"
          maxlength="20"
          autocomplete="nickname"
          :placeholder="t('profile.namePlaceholder')"
          class="mt-1.5 w-full rounded-xl border border-brand-200 bg-surface px-4 py-3 text-base outline-none focus:border-brand-500"
        />
      </div>

      <fieldset v-if="hasAvatars">
        <legend class="block text-sm font-semibold text-brand-900">
          {{ t('profile.avatarLabel') }}
        </legend>
        <div class="mt-2 grid grid-cols-4 gap-2">
          <button
            v-for="option in tenant.settings.avatars"
            :key="option.id"
            type="button"
            class="overflow-hidden rounded-xl border-2 p-0.5"
            :class="option.id === avatarId ? 'border-brand-500 bg-brand-50' : 'border-brand-100 bg-surface'"
            :aria-pressed="option.id === avatarId"
            @click="avatarId = option.id"
          >
            <img
              :src="option.url"
              :alt="option.label"
              class="aspect-square w-full rounded-lg object-cover"
            />
          </button>
        </div>
      </fieldset>
      <p v-else class="text-xs text-muted">{{ t('profile.avatarsEmpty') }}</p>

      <div>
        <BaseButton size="lg" :disabled="!dirty" @click="save">{{ t('profile.save') }}</BaseButton>
        <p v-if="savedAt && !dirty" class="mt-2 text-center text-xs font-semibold text-green-700">
          {{ t('profile.saved') }}
        </p>
      </div>
    </div>

    <!-- ── Account ─────────────────────────────────────────────── -->
    <div class="mt-8 rounded-card bg-surface p-4 shadow-sm ring-1 ring-brand-100">
      <h2 class="text-sm font-bold uppercase tracking-wide text-brand-900">
        {{ t('profile.accountHeading') }}
      </h2>

      <template v-if="session.isFan">
        <p class="mt-1 text-xs text-muted" translate="no">
          {{ t('profile.signedInAs', { email: session.email }) }}
        </p>
        <button type="button" class="mt-2 text-sm font-semibold text-brand-600" @click="signOut">
          {{ t('profile.signOut') }}
        </button>
      </template>

      <template v-else>
        <p class="mt-1 text-xs text-muted">{{ t('profile.guestNotice') }}</p>
        <RouterLink
          :to="{ name: 'signin' }"
          class="mt-2 inline-block text-sm font-semibold text-brand-600"
        >
          {{ t('profile.signIn') }}
        </RouterLink>
      </template>
    </div>
  </section>
</template>
