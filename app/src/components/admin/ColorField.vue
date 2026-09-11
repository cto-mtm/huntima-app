<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { isValidHex, normalizeHex } from '../../lib/color'

const props = defineProps<{
  modelValue: string
  label: string
  help: string
  ramp: Record<number, string>
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const { t } = useI18n()

// Local draft so a half-typed hex ("#2f5") doesn't repaint the whole app on
// every keystroke. Only valid values are committed upward.
const draft = ref(props.modelValue)
watch(
  () => props.modelValue,
  (next) => {
    if (normalizeHex(next) !== normalizeHex(draft.value || '#000000')) draft.value = next
  },
)

const valid = computed(() => isValidHex(draft.value))

function commit(value: string): void {
  draft.value = value
  if (isValidHex(value)) emit('update:modelValue', normalizeHex(value))
}

const stops = computed(() =>
  Object.entries(props.ramp)
    .map(([stop, hex]) => ({ stop: Number(stop), hex }))
    .sort((a, b) => a.stop - b.stop),
)
</script>

<template>
  <div>
    <label class="block text-sm font-semibold text-brand-900" :for="`color-${label}`">
      {{ label }}
    </label>
    <p class="mt-0.5 text-xs text-muted">{{ help }}</p>

    <div class="mt-2 flex items-center gap-2">
      <!-- Native picker for choosing, text input for pasting a brand hex from
           a style guide. Marketing teams always have the hex. -->
      <input
        :id="`color-${label}`"
        type="color"
        :value="valid ? normalizeHex(draft) : '#000000'"
        class="size-11 shrink-0 cursor-pointer rounded-lg border border-brand-200 bg-surface p-1"
        @input="commit(($event.target as HTMLInputElement).value)"
      />
      <input
        v-model="draft"
        type="text"
        spellcheck="false"
        autocomplete="off"
        class="w-full rounded-xl border bg-surface px-3 py-2.5 font-mono text-sm outline-none"
        :class="valid ? 'border-brand-200 focus:border-brand-500' : 'border-red-400'"
        @input="commit(draft)"
      />
    </div>

    <p v-if="!valid" class="mt-1 text-xs font-medium text-red-600">{{ t('admin.invalidHex') }}</p>

    <div class="mt-2">
      <p class="text-[11px] font-semibold uppercase tracking-wide text-muted">
        {{ t('admin.rampLabel') }}
      </p>
      <div class="mt-1 flex overflow-hidden rounded-lg ring-1 ring-brand-100">
        <div
          v-for="s in stops"
          :key="s.stop"
          class="h-9 flex-1"
          :style="{ backgroundColor: s.hex }"
          :title="`${s.stop} · ${s.hex}`"
        />
      </div>
    </div>
  </div>
</template>
