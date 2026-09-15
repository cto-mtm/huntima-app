<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import type { Mission, Prize } from 'shared'
import BaseButton from '../../components/BaseButton.vue'
import MissionTargetField from '../../components/admin/MissionTargetField.vue'
import MissionGeoField, { type Geo } from '../../components/admin/MissionGeoField.vue'
import { useHuntsStore } from '../../stores/hunts'
import { useTenantStore } from '../../stores/tenant'
import { uploadImage } from '../../lib/storage'

const { t } = useI18n()
const route = useRoute()
const hunts = useHuntsStore()
const tenant = useTenantStore()

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

// The prize is a campaign-level field, saved via PATCH (hunts.patch), separate
// from the whole-list mission save — so it gets its own draft and dirty flag.
const emptyPrize: Prize = { name: '', description: '', imageUrl: null, winnerLimit: 0 }
const prize = ref<Prize>({ ...emptyPrize })
const prizeDirty = ref(false)
const prizeSavedAt = ref<number | null>(null)
const prizeUploading = ref(false)
const prizeUploadError = ref(false)

// How many badges win, saved alongside the prize (both campaign-level). Guarded
// against the mission count so staff can't publish an unwinnable hunt (target 5,
// two missions) — the bug behind the old 2-mission / 5-badge screenshot.
const badgeTargetDraft = ref(1)
const maxTarget = computed(() => Math.max(1, draft.value.length))
const targetExceedsMissions = computed(() => badgeTargetDraft.value > draft.value.length)

onMounted(async () => {
  await hunts.loadOne(huntId.value)
})

// Initialize the drafts ONCE per hunt, not on every change to hunts.current.
// Saving the prize PATCHes the campaign and updates current with unchanged
// missions; re-syncing here would silently discard unsaved mission edits (and
// vice versa). Same hunt id → keep the local drafts.
let loadedFor: string | null = null
watch(
  () => hunts.current,
  (campaign) => {
    // The id must match THIS page's hunt: `current` can still hold the
    // previously edited hunt when this fires immediately on mount, and
    // seeding the draft from it would let a failed load save hunt A's
    // missions over hunt B.
    if (!campaign || campaign.id !== huntId.value || campaign.id === loadedFor) return
    loadedFor = campaign.id
    draft.value = campaign.missions.map((m) => ({ ...m }))
    prize.value = campaign.prize ? { ...campaign.prize } : { ...emptyPrize }
    badgeTargetDraft.value = campaign.badgeTarget
    dirty.value = false
    prizeDirty.value = false
  },
  { immediate: true },
)

function markPrizeDirty(): void {
  prizeDirty.value = true
  prizeSavedAt.value = null
}

async function savePrize(): Promise<void> {
  // Clamp so a hunt is never saved needing more badges than it has missions.
  const badgeTarget = Math.max(1, Math.min(badgeTargetDraft.value || 1, maxTarget.value))
  badgeTargetDraft.value = badgeTarget
  if (await hunts.patch(huntId.value, { prize: prize.value, badgeTarget })) {
    prizeDirty.value = false
    prizeSavedAt.value = Date.now()
  }
}

async function onPrizeImage(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  prizeUploading.value = true
  prizeUploadError.value = false
  try {
    // Reuses the campaign target-photo path/rules rather than a new storage
    // location — it is the same kind of staff-uploaded, world-read image.
    const { url } = await uploadImage(
      'mission-target',
      { slug: tenant.slug ?? '', campaignId: huntId.value },
      file,
    )
    prize.value.imageUrl = url
    markPrizeDirty()
  } catch {
    prizeUploadError.value = true
  } finally {
    prizeUploading.value = false
  }
}

function removePrizeImage(): void {
  prize.value.imageUrl = null
  markPrizeDirty()
}

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
    // Both optional in the contract, both explicit here: a new mission joins
    // whatever level the author types next and has no location until somebody
    // points at the map.
    group: null,
    geo: null,
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

/** A level name, or null when the field is blank — "no level" is the default,
 *  not an empty-named one, which would render as a chapter with no title. */
function groupOf(mission: Mission): string {
  const value = mission.group
  return value && 'text' in value ? value.text : ''
}

function setGroup(mission: Mission, value: string): void {
  const trimmed = value.trim()
  mission.group = trimmed ? { text: value } : null
  markDirty()
}

function setGeo(mission: Mission, geo: Geo | null): void {
  mission.geo = geo
  markDirty()
}

/**
 * Level names already used in this hunt, offered as a datalist.
 *
 * Levels are grouped by their exact text, so "Level 1" and "level 1" are two
 * different chapters. Autocompleting from what is already there is the
 * cheapest way to stop that happening — a <select> would be wrong, because
 * the first mission of a new level has to be able to invent one.
 */
const groupSuggestions = computed(() => [
  ...new Set(draft.value.map(groupOf).filter((name) => name.length > 0)),
])

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

    <!-- ── Prize ───────────────────────────────────────────────────
         A campaign-level field with its own save, because it PATCHes the
         hunt document rather than replacing the mission list. -->
    <section class="mt-6 rounded-card bg-surface p-4 shadow-sm ring-1 ring-brand-100">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-sm font-bold uppercase tracking-wide text-brand-900">
            {{ t('hunts.prizeHeading') }}
          </h2>
          <p class="mt-0.5 text-xs text-muted">{{ t('hunts.prizeHelp') }}</p>
        </div>
        <div class="text-right">
          <BaseButton :disabled="!prizeDirty || hunts.saving" @click="savePrize">
            {{ t('hunts.prizeSave') }}
          </BaseButton>
          <p v-if="prizeSavedAt && !prizeDirty" class="mt-1 text-xs font-medium text-green-700">
            {{ t('hunts.prizeSaved') }}
          </p>
        </div>
      </div>

      <div class="mt-4 grid gap-3">
        <div>
          <label for="badges-to-win" class="block text-xs font-semibold text-brand-900">
            {{ t('hunts.badgesToWinLabel') }}
          </label>
          <input
            id="badges-to-win"
            v-model.number="badgeTargetDraft"
            type="number"
            min="1"
            :max="maxTarget"
            class="mt-1 w-24 rounded-xl border border-brand-200 bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500"
            @input="markPrizeDirty"
          />
          <p
            class="mt-0.5 text-xs"
            :class="targetExceedsMissions ? 'font-medium text-red-600' : 'text-muted'"
          >
            {{ t('hunts.badgesToWinHelp', { count: draft.length }) }}
          </p>
        </div>

        <div>
          <label for="prize-name" class="block text-xs font-semibold text-brand-900">
            {{ t('hunts.prizeNameLabel') }}
          </label>
          <input
            id="prize-name"
            v-model="prize.name"
            type="text"
            maxlength="80"
            :placeholder="t('hunts.prizeNamePlaceholder')"
            class="mt-1 w-full rounded-xl border border-brand-200 bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500"
            @input="markPrizeDirty"
          />
        </div>

        <div>
          <label for="prize-desc" class="block text-xs font-semibold text-brand-900">
            {{ t('hunts.prizeDescLabel') }}
          </label>
          <textarea
            id="prize-desc"
            v-model="prize.description"
            rows="2"
            maxlength="500"
            :placeholder="t('hunts.prizeDescPlaceholder')"
            class="mt-1 w-full rounded-xl border border-brand-200 bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500"
            @input="markPrizeDirty"
          />
        </div>

        <div>
          <label for="prize-winners" class="block text-xs font-semibold text-brand-900">
            {{ t('hunts.prizeWinnersLabel') }}
          </label>
          <input
            id="prize-winners"
            v-model.number="prize.winnerLimit"
            type="number"
            min="0"
            max="1000000"
            class="mt-1 w-32 rounded-xl border border-brand-200 bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500"
            @input="markPrizeDirty"
          />
          <p class="mt-0.5 text-xs text-muted">{{ t('hunts.prizeWinnersHelp') }}</p>
        </div>

        <div>
          <p class="text-xs font-semibold text-brand-900">{{ t('hunts.prizeImageLabel') }}</p>
          <div class="mt-1 flex items-center gap-3">
            <img
              v-if="prize.imageUrl"
              :src="prize.imageUrl"
              alt=""
              class="size-16 rounded-lg object-cover ring-1 ring-brand-100"
            />
            <label
              class="cursor-pointer rounded-xl border border-brand-200 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
            >
              {{ prizeUploading ? t('hunts.prizeUploading') : t('hunts.prizeUpload') }}
              <input
                type="file"
                accept="image/*"
                class="sr-only"
                :disabled="prizeUploading"
                @change="onPrizeImage"
              />
            </label>
            <button
              v-if="prize.imageUrl"
              type="button"
              class="text-xs font-semibold text-red-600"
              @click="removePrizeImage"
            >
              {{ t('hunts.prizeRemoveImage') }}
            </button>
          </div>
          <p v-if="prizeUploadError" class="mt-1 text-xs font-medium text-red-600">
            {{ t('hunts.prizeUploadFailed') }}
          </p>
        </div>
      </div>
    </section>

    <!-- Shared by every level field on the page: one list of the names this
         hunt already uses, so a second mission joins "Level 1: Rookie"
         instead of founding "level 1 rookie" beside it. -->
    <datalist :id="`groups-${huntId}`">
      <option v-for="name in groupSuggestions" :key="name" :value="name" />
    </datalist>

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

        <div v-if="!isSeeded(mission)" class="mt-3">
          <label :for="`group-${mission.id}`" class="block text-xs font-semibold text-brand-900">
            {{ t('hunts.groupLabel') }}
          </label>
          <p class="mt-0.5 text-xs text-muted">{{ t('hunts.groupHelp') }}</p>
          <input
            :id="`group-${mission.id}`"
            :value="groupOf(mission)"
            type="text"
            maxlength="200"
            :list="`groups-${huntId}`"
            :placeholder="t('hunts.groupPlaceholder')"
            class="mt-1 w-full rounded-xl border border-brand-200 bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500"
            @input="setGroup(mission, ($event.target as HTMLInputElement).value)"
          />
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

        <MissionGeoField
          class="mt-4"
          :model-value="mission.geo"
          :color="mission.color"
          @update:model-value="(geo) => setGeo(mission, geo)"
        />
      </li>
    </ul>

    <div class="mt-5">
      <BaseButton variant="secondary" @click="addMission">{{ t('hunts.addMission') }}</BaseButton>
    </div>
  </section>
</template>
