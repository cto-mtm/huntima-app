<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import type { Mission } from 'shared'
import AdminNav from '../../components/admin/AdminNav.vue'
import BaseButton from '../../components/BaseButton.vue'
import MissionTargetField from '../../components/admin/MissionTargetField.vue'
import { useHuntsStore } from '../../stores/hunts'

const { t } = useI18n()
const route = useRoute()
const hunts = useHuntsStore()

const huntId = computed(() => String(route.params.id))

/**
 * A local draft, committed as a unit.
 *
 * Per-mission saves would let a fan load a hunt mid-edit and see three of
 * five steps. Everything here edits the draft; "Save missions" writes the
 * whole list in one request.
 */
const draft = ref<Mission[]>([])
const dirty = ref(false)
const savedAt = ref<number | null>(null)

onMounted(async () => {
  await hunts.loadOne(huntId.value)
})

watch(
  () => hunts.current,
  (campaign) => {
    if (campaign) draft.value = campaign.missions.map((m) => ({ ...m }))
    dirty.value = false
  },
  { immediate: true },
)

function markDirty(): void {
  dirty.value = true
  savedAt.value = null
}

function addMission(): void {
  draft.value.push({
    id: crypto.randomUUID(),
    kind: 'photo',
    // Staff-authored copy is literal text, never an i18n key — it is
    // user-generated content, shown verbatim. See docs/i18n.md.
    title: { text: '' },
    hint: { text: '' },
    color: '#3b6ea5',
    targetImageUrl: null,
    order: draft.value.length,
  })
  markDirty()
}

/** Seeded demo missions carry i18n keys and are not editable as prose. */
function isSeeded(mission: Mission): boolean {
  return 'key' in mission.title
}

function textOf(mission: Mission, field: 'title' | 'hint'): string {
  const value = mission[field]
  return 'text' in value ? value.text : ''
}

function setText(mission: Mission, field: 'title' | 'hint', value: string): void {
  mission[field] = { text: value }
  markDirty()
}

function move(index: number, delta: number): void {
  const next = index + delta
  if (next < 0 || next >= draft.value.length) return
  const copy = [...draft.value]
  ;[copy[index], copy[next]] = [copy[next], copy[index]]
  draft.value = copy
  markDirty()
}

function removeMission(index: number): void {
  draft.value = draft.value.filter((_, i) => i !== index)
  markDirty()
}

const canSave = computed(
  () => dirty.value && draft.value.every((m) => isSeeded(m) || textOf(m, 'title').trim().length > 0),
)

async function save(): Promise<void> {
  if (await hunts.saveMissions(huntId.value, draft.value)) {
    dirty.value = false
    savedAt.value = Date.now()
  }
}
</script>

<template>
  <section class="py-5">
    <AdminNav />

    <header class="mt-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <RouterLink :to="{ name: 'admin-hunts' }" class="text-xs font-semibold text-brand-600">
          ← {{ t('hunts.backToHunts') }}
        </RouterLink>
        <h1 class="mt-1 text-2xl font-extrabold text-brand-900">
          {{ hunts.current?.name ?? t('hunts.editHeading') }}
        </h1>
        <p class="mt-1 text-sm text-muted">{{ t('hunts.editHelp') }}</p>
      </div>

      <div class="text-right">
        <BaseButton :disabled="!canSave || hunts.saving" @click="save">
          {{ hunts.saving ? t('hunts.saving') : t('hunts.save') }}
        </BaseButton>
        <p v-if="dirty" class="mt-1 text-xs font-medium text-accent-600">{{ t('hunts.unsaved') }}</p>
        <p v-else-if="savedAt" class="mt-1 text-xs font-medium text-green-700">
          {{ t('hunts.saved') }}
        </p>
      </div>
    </header>

    <p v-if="hunts.error" class="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
      {{ t('hunts.saveFailed') }} {{ hunts.error }}
    </p>

    <ul class="mt-6 grid gap-4">
      <li
        v-for="(mission, index) in draft"
        :key="mission.id"
        class="rounded-card bg-surface p-4 shadow-sm ring-1 ring-brand-100"
      >
        <div class="flex items-center justify-between gap-2">
          <span class="font-mono text-xs text-muted">{{ index + 1 }}</span>
          <div class="flex items-center gap-1">
            <button
              type="button"
              class="rounded px-2 py-1 text-xs font-semibold text-brand-600 disabled:opacity-30"
              :disabled="index === 0"
              :aria-label="t('hunts.moveUp')"
              @click="move(index, -1)"
            >
              ↑
            </button>
            <button
              type="button"
              class="rounded px-2 py-1 text-xs font-semibold text-brand-600 disabled:opacity-30"
              :disabled="index === draft.length - 1"
              :aria-label="t('hunts.moveDown')"
              @click="move(index, 1)"
            >
              ↓
            </button>
            <button
              type="button"
              class="rounded px-2 py-1 text-xs font-semibold text-red-600"
              @click="removeMission(index)"
            >
              {{ t('hunts.removeMission') }}
            </button>
          </div>
        </div>

        <p v-if="isSeeded(mission)" class="mt-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
          {{ t('hunts.seededNotice') }}
        </p>

        <div v-else class="mt-3 grid gap-3">
          <div>
            <label :for="`title-${mission.id}`" class="block text-xs font-semibold text-brand-900">
              {{ t('hunts.missionTitleLabel') }}
            </label>
            <input
              :id="`title-${mission.id}`"
              :value="textOf(mission, 'title')"
              type="text"
              maxlength="200"
              :placeholder="t('hunts.missionTitlePlaceholder')"
              class="mt-1 w-full rounded-xl border border-brand-200 bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500"
              @input="setText(mission, 'title', ($event.target as HTMLInputElement).value)"
            />
          </div>

          <div>
            <label :for="`hint-${mission.id}`" class="block text-xs font-semibold text-brand-900">
              {{ t('hunts.missionHintLabel') }}
            </label>
            <textarea
              :id="`hint-${mission.id}`"
              :value="textOf(mission, 'hint')"
              rows="2"
              maxlength="200"
              :placeholder="t('hunts.missionHintPlaceholder')"
              class="mt-1 w-full rounded-xl border border-brand-200 bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500"
              @input="setText(mission, 'hint', ($event.target as HTMLTextAreaElement).value)"
            />
          </div>
        </div>

        <div class="mt-3 flex flex-wrap items-end gap-4">
          <div>
            <label :for="`kind-${mission.id}`" class="block text-xs font-semibold text-brand-900">
              {{ t('hunts.kindLabel') }}
            </label>
            <select
              :id="`kind-${mission.id}`"
              v-model="mission.kind"
              class="mt-1 rounded-xl border border-brand-200 bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500"
              @change="markDirty"
            >
              <option value="photo">{{ t('hunts.kindPhoto') }}</option>
              <option value="spyglass">{{ t('hunts.kindSpyglass') }}</option>
            </select>
          </div>

          <div>
            <label :for="`color-${mission.id}`" class="block text-xs font-semibold text-brand-900">
              {{ t('hunts.colorLabel') }}
            </label>
            <input
              :id="`color-${mission.id}`"
              v-model="mission.color"
              type="color"
              class="mt-1 size-11 cursor-pointer rounded-lg border border-brand-200 bg-surface p-1"
              @change="markDirty"
            />
          </div>
        </div>

        <MissionTargetField
          class="mt-4"
          :campaign-id="huntId"
          :model-value="mission.targetImageUrl"
          @update:model-value="
            (url: string | null) => {
              mission.targetImageUrl = url
              markDirty()
            }
          "
        />
      </li>
    </ul>

    <div class="mt-5">
      <BaseButton variant="secondary" @click="addMission">{{ t('hunts.addMission') }}</BaseButton>
    </div>
  </section>
</template>
