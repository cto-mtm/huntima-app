<script setup lang="ts">
/**
 * Upload / replace / remove the target photo for one mission.
 *
 * This image does double duty: it is the clue the fan is shown, and the
 * reference their capture is compared against. One upload, both jobs —
 * splitting them would mean staff maintaining two pictures of the same statue.
 */
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { uploadImage } from '../../lib/storage'

const props = defineProps<{
  campaignId: string
  modelValue: string | null
}>()

const emit = defineEmits<{ 'update:modelValue': [url: string | null] }>()

const { t } = useI18n()

const input = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const error = ref<string | null>(null)

async function onChosen(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  uploading.value = true
  error.value = null

  try {
    const { url } = await uploadImage('mission-target', props.campaignId, file)
    emit('update:modelValue', url)
  } catch (err) {
    // Staff are looking at a form and need a sentence, not a console entry.
    error.value = err instanceof Error ? err.message : t('hunts.uploadFailed')
  } finally {
    uploading.value = false
    if (input.value) input.value.value = ''
  }
}
</script>

<template>
  <div>
    <p class="text-xs font-bold uppercase tracking-wide text-brand-900">
      {{ t('hunts.targetHeading') }}
    </p>
    <p class="mt-0.5 text-xs text-muted">{{ t('hunts.targetHelp') }}</p>

    <div class="mt-2 flex items-start gap-3">
      <img
        v-if="props.modelValue"
        :src="props.modelValue"
        alt=""
        class="size-24 shrink-0 rounded-xl object-cover ring-1 ring-brand-100"
      />
      <div
        v-else
        class="flex size-24 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-brand-200 text-2xl text-muted"
        aria-hidden="true"
      >
        📷
      </div>

      <div class="min-w-0 flex-1">
        <input ref="input" type="file" accept="image/*" class="sr-only" @change="onChosen" />

        <button
          type="button"
          class="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 disabled:opacity-60"
          :disabled="uploading"
          @click="input?.click()"
        >
          {{ uploading ? t('hunts.uploading') : t('hunts.uploadTarget') }}
        </button>

        <button
          v-if="props.modelValue"
          type="button"
          class="ml-2 text-xs font-semibold text-red-600"
          @click="emit('update:modelValue', null)"
        >
          {{ t('hunts.removeTarget') }}
        </button>

        <p v-if="error" class="mt-1.5 text-xs font-medium text-red-600">{{ error }}</p>
        <p v-else-if="!props.modelValue" class="mt-1.5 text-xs text-muted">
          {{ t('hunts.targetMissing') }}
        </p>
      </div>
    </div>
  </div>
</template>
