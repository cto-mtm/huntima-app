<script setup lang="ts">
/**
 * Team logo and fan avatars — the two image sets that define a club's look.
 *
 * Both are public in Storage, because every fan's app renders them and fans
 * are anonymous, so there is nobody to authenticate a read against.
 *
 * Avatars carry a stable `id` separate from their URL. Progress stores the
 * id, so re-uploading the set cannot silently give a fan a different face.
 */
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { TenantAvatar } from 'shared'
import { uploadImage, UploadError } from '../../lib/storage'
import { useTenantStore } from '../../stores/tenant'

const { t } = useI18n()
const tenant = useTenantStore()

const logoInput = ref<HTMLInputElement | null>(null)
const avatarInput = ref<HTMLInputElement | null>(null)
const busy = ref<'logo' | 'avatar' | null>(null)
const error = ref<string | null>(null)

/** Maps an upload failure to localized copy: known codes get a specific
 *  message, everything else falls back to the generic one. */
function uploadErrorMessage(err: unknown): string {
  if (err instanceof UploadError) {
    if (err.code === 'not-image') return t('admin.uploadNotImage')
    if (err.code === 'too-large') return t('admin.uploadTooLarge')
  }
  return t('admin.uploadFailed')
}

function labelFromFile(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim().slice(0, 40) || 'Avatar'
}

async function onLogo(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  busy.value = 'logo'
  error.value = null
  try {
    // The router guard guarantees an active slug on every admin route.
    const { url } = await uploadImage('team-asset', { slug: tenant.slug ?? '' }, file)
    tenant.settings.logoUrl = url
  } catch (err) {
    error.value = uploadErrorMessage(err)
  } finally {
    busy.value = null
    if (logoInput.value) logoInput.value.value = ''
  }
}

async function onAvatar(event: Event): Promise<void> {
  const files = Array.from((event.target as HTMLInputElement).files ?? [])
  if (!files.length) return

  busy.value = 'avatar'
  error.value = null
  try {
    for (const file of files) {
      const { url } = await uploadImage('team-asset', { slug: tenant.slug ?? '' }, file)
      const avatar: TenantAvatar = {
        id: crypto.randomUUID(),
        url,
        label: labelFromFile(file.name),
      }
      tenant.settings.avatars = [...tenant.settings.avatars, avatar]
    }
  } catch (err) {
    error.value = uploadErrorMessage(err)
  } finally {
    busy.value = null
    if (avatarInput.value) avatarInput.value.value = ''
  }
}

function removeAvatar(id: string): void {
  tenant.settings.avatars = tenant.settings.avatars.filter((a) => a.id !== id)
}
</script>

<template>
  <div class="space-y-6">
    <!-- ── Logo ─────────────────────────────────────────────────── -->
    <fieldset>
      <legend class="text-sm font-bold uppercase tracking-wide text-brand-900">
        {{ t('admin.logoHeading') }}
      </legend>
      <p class="mt-0.5 text-xs text-muted">{{ t('admin.logoHelp') }}</p>

      <input ref="logoInput" type="file" accept="image/*" class="sr-only" @change="onLogo" />

      <div class="mt-2 flex items-center gap-3">
        <img
          v-if="tenant.settings.logoUrl"
          :src="tenant.settings.logoUrl"
          alt=""
          class="size-16 rounded-xl object-contain ring-1 ring-brand-100"
        />
        <div
          v-else
          class="flex size-16 items-center justify-center rounded-xl border-2 border-dashed border-brand-200 text-[10px] text-muted"
        >
          {{ t('admin.logoMissing') }}
        </div>

        <div>
          <button
            type="button"
            class="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 disabled:opacity-60"
            :disabled="busy === 'logo'"
            @click="logoInput?.click()"
          >
            {{ busy === 'logo' ? t('admin.uploading') : t('admin.uploadLogo') }}
          </button>
          <button
            v-if="tenant.settings.logoUrl"
            type="button"
            class="ml-2 text-xs font-semibold text-red-600"
            @click="tenant.settings.logoUrl = null"
          >
            {{ t('admin.removeImage') }}
          </button>
        </div>
      </div>
    </fieldset>

    <!-- ── Avatars ──────────────────────────────────────────────── -->
    <fieldset>
      <legend class="text-sm font-bold uppercase tracking-wide text-brand-900">
        {{ t('admin.avatarsHeading') }}
      </legend>
      <p class="mt-0.5 text-xs text-muted">{{ t('admin.avatarsHelp') }}</p>

      <input
        ref="avatarInput"
        type="file"
        accept="image/*"
        multiple
        class="sr-only"
        @change="onAvatar"
      />

      <ul v-if="tenant.settings.avatars.length" class="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6">
        <li v-for="avatar in tenant.settings.avatars" :key="avatar.id" class="relative">
          <img
            :src="avatar.url"
            :alt="avatar.label"
            class="aspect-square w-full rounded-xl object-cover ring-1 ring-brand-100"
          />
          <button
            type="button"
            class="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-red-600 text-[11px] font-bold text-white"
            :aria-label="t('admin.removeImage')"
            @click="removeAvatar(avatar.id)"
          >
            ×
          </button>
        </li>
      </ul>

      <p v-else class="mt-2 text-xs text-muted">{{ t('admin.avatarsEmptyNotice') }}</p>

      <button
        type="button"
        class="mt-2 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 disabled:opacity-60"
        :disabled="busy === 'avatar'"
        @click="avatarInput?.click()"
      >
        {{ busy === 'avatar' ? t('admin.uploading') : t('admin.uploadAvatars') }}
      </button>

      <p v-if="error" class="mt-1.5 text-xs font-medium text-red-600">{{ error }}</p>
    </fieldset>
  </div>
</template>
