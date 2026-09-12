<script setup lang="ts">
/**
 * Team asset uploads (logos, marks).
 *
 * Uploaded files are PUBLIC — every fan's app renders them and fans are
 * anonymous, so there is nobody to authenticate a read against. That is fine
 * for a club logo and wrong for anything else, which is why this is scoped to
 * assets rather than being a general file manager.
 */
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { uploadImage } from '../../lib/storage'

// Single-tenant for now: one deployment serves one club. When the platform
// hosts several, this becomes the tenant's id and Storage rules gain a
// membership check instead of a bare admin claim.
const TENANT_ID = 'default'

const { t } = useI18n()

const input = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const error = ref<string | null>(null)
const uploaded = ref<{ url: string; name: string }[]>([])

async function onChosen(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  uploading.value = true
  error.value = null

  try {
    const { url } = await uploadImage('team-asset', TENANT_ID, file)
    uploaded.value = [{ url, name: file.name }, ...uploaded.value]
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('hunts.uploadFailed')
  } finally {
    uploading.value = false
    if (input.value) input.value.value = ''
  }
}
</script>

<template>
  <fieldset>
    <legend class="text-sm font-bold uppercase tracking-wide text-brand-900">
      {{ t('hunts.assetsHeading') }}
    </legend>
    <p class="mt-0.5 text-xs text-muted">{{ t('hunts.assetsHelp') }}</p>

    <input ref="input" type="file" accept="image/*" class="sr-only" @change="onChosen" />

    <button
      type="button"
      class="mt-2 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 disabled:opacity-60"
      :disabled="uploading"
      @click="input?.click()"
    >
      {{ uploading ? t('hunts.uploading') : t('hunts.uploadAsset') }}
    </button>

    <p v-if="error" class="mt-1.5 text-xs font-medium text-red-600">{{ error }}</p>

    <ul v-if="uploaded.length" class="mt-3 grid gap-2">
      <li
        v-for="asset in uploaded"
        :key="asset.url"
        class="flex items-center gap-2.5 rounded-xl bg-surface p-2 ring-1 ring-brand-100"
      >
        <img :src="asset.url" alt="" class="size-10 shrink-0 rounded-lg object-contain" />
        <span class="min-w-0 flex-1 truncate text-xs text-brand-900">{{ asset.name }}</span>
        <a
          :href="asset.url"
          target="_blank"
          rel="noopener"
          class="shrink-0 text-xs font-semibold text-brand-600"
        >
          {{ t('hunts.assetUploaded') }}
        </a>
      </li>
    </ul>
  </fieldset>
</template>
