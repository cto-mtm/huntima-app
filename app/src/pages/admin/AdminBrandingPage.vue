<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '../../components/BaseButton.vue'
import ColorField from '../../components/admin/ColorField.vue'
import PhonePreview from '../../components/admin/PhonePreview.vue'
import { contrastRatio, gradeContrast, type ContrastGrade } from '../../lib/color'
import { useTenantStore } from '../../stores/tenant'
import { FONTS } from '../../lib/fonts'
import { FONT_CHOICES } from 'shared'
import AdminNav from '../../components/admin/AdminNav.vue'
import TenantImagesField from '../../components/admin/TenantImagesField.vue'
import AdminDiagnostics from '../../components/admin/AdminDiagnostics.vue'

const { t } = useI18n()
const tenant = useTenantStore()


const GRADE_KEY: Record<ContrastGrade, string> = {
  aaa: 'admin.gradeAaa',
  aa: 'admin.gradeAa',
  'aa-large': 'admin.gradeAaLarge',
  fail: 'admin.gradeFail',
}

/**
 * The two pairings that actually carry text in the fan app: the primary
 * button (white on brand-600) and the win-state accent (white on accent-600).
 * A brand color that fails here produces buttons nobody can read in daylight.
 */
const contrastChecks = computed(() =>
  [
    { stop: 'brand-600', hex: tenant.brandRamp[600] },
    { stop: 'accent-600', hex: tenant.accentRamp[600] },
  ].map((c) => {
    const ratio = contrastRatio(c.hex, '#ffffff')
    const grade = gradeContrast(ratio)
    return { ...c, ratio: ratio.toFixed(2), grade, gradeKey: GRADE_KEY[grade] }
  }),
)

const GRADE_CLASS: Record<ContrastGrade, string> = {
  aaa: 'bg-green-100 text-green-700',
  aa: 'bg-green-100 text-green-700',
  'aa-large': 'bg-amber-100 text-amber-700',
  fail: 'bg-red-100 text-red-700',
}

function gradeClass(grade: ContrastGrade): string {
  return GRADE_CLASS[grade]
}

// ── Stadium geofence ────────────────────────────────────────────────
const venueLocating = ref(false)
const venueError = ref(false)

/** Materialize an editable venue when turned on; null (no restriction) off. */
function toggleVenue(on: boolean): void {
  tenant.settings.venue = on ? { lat: 0, lng: 0, radiusMeters: 300 } : null
}

/** Fill lat/lng from the admin's device — staff stand at the stadium and tap. */
function useMyLocation(): void {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    venueError.value = true
    return
  }
  venueLocating.value = true
  venueError.value = false
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      tenant.settings.venue = {
        lat: Number(pos.coords.latitude.toFixed(6)),
        lng: Number(pos.coords.longitude.toFixed(6)),
        radiusMeters: tenant.settings.venue?.radiusMeters ?? 300,
      }
      venueLocating.value = false
    },
    () => {
      venueLocating.value = false
      venueError.value = true
    },
    { enableHighAccuracy: true, timeout: 8000 },
  )
}
</script>

<template>
  <section class="py-5">
    <AdminNav />

    <header class="mt-5">
      <div>
        <h1 class="text-2xl font-extrabold text-brand-900">{{ t('admin.title') }}</h1>
        <p class="mt-1 text-sm text-muted">{{ t('admin.subtitle') }}</p>
      </div>
    </header>

    <!-- Branding is published, not auto-saved. Every keystroke reaching a
         stadium full of phones is not a feature; previewing locally and
         publishing deliberately is. -->
    <div class="mt-4 flex flex-wrap items-center gap-3">
      <BaseButton :disabled="!tenant.dirty || tenant.saving" @click="tenant.save()">
        {{ tenant.saving ? t('admin.saving') : t('admin.saveBranding') }}
      </BaseButton>
      <p v-if="tenant.error" class="text-xs font-medium text-red-600">
        {{ t('admin.saveFailed') }} {{ tenant.error }}
      </p>
      <p v-else-if="tenant.dirty" class="text-xs font-medium text-accent-600">
        {{ t('admin.unsavedNote') }}
      </p>
      <p v-else class="text-xs font-medium text-green-700">{{ t('admin.savedNote') }}</p>
    </div>

    <div class="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <!-- ── Controls ──────────────────────────────────────────── -->
      <div class="space-y-8">
        <fieldset class="space-y-4">
          <legend class="text-sm font-bold uppercase tracking-wide text-brand-900">
            {{ t('admin.identityHeading') }}
          </legend>

          <div>
            <label for="team-name" class="block text-sm font-semibold text-brand-900">
              {{ t('admin.teamNameLabel') }}
            </label>
            <p class="mt-0.5 text-xs text-muted">{{ t('admin.teamNameHelp') }}</p>
            <input
              id="team-name"
              v-model="tenant.settings.teamName"
              type="text"
              class="mt-2 w-full rounded-xl border border-brand-200 bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label for="prize-location" class="block text-sm font-semibold text-brand-900">
              {{ t('admin.prizeLocationLabel') }}
            </label>
            <p class="mt-0.5 text-xs text-muted">{{ t('admin.prizeLocationHelp') }}</p>
            <input
              id="prize-location"
              v-model="tenant.settings.prizeLocation"
              type="text"
              class="mt-2 w-full rounded-xl border border-brand-200 bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label for="badge-target" class="block text-sm font-semibold text-brand-900">
              {{ t('admin.badgeTargetLabel') }}
            </label>
            <p class="mt-0.5 text-xs text-muted">{{ t('admin.badgeTargetHelp') }}</p>
            <input
              id="badge-target"
              v-model.number="tenant.settings.badgeTarget"
              type="number"
              min="1"
              max="20"
              class="mt-2 w-28 rounded-xl border border-brand-200 bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500"
            />
          </div>
        </fieldset>

        <fieldset class="space-y-3">
          <legend class="text-sm font-bold uppercase tracking-wide text-brand-900">
            {{ t('admin.venueHeading') }}
          </legend>
          <p class="text-xs text-muted">{{ t('admin.venueHelp') }}</p>

          <label class="flex items-center gap-2 text-sm font-semibold text-brand-900">
            <input
              type="checkbox"
              class="size-4 rounded border-brand-300 text-brand-600"
              :checked="!!tenant.settings.venue"
              @change="toggleVenue(($event.target as HTMLInputElement).checked)"
            />
            {{ t('admin.venueEnableLabel') }}
          </label>

          <div v-if="tenant.settings.venue" class="space-y-3">
            <div class="flex flex-wrap gap-3">
              <div>
                <label for="venue-lat" class="block text-xs font-semibold text-brand-900">
                  {{ t('admin.venueLatLabel') }}
                </label>
                <input
                  id="venue-lat"
                  v-model.number="tenant.settings.venue.lat"
                  type="number"
                  step="0.000001"
                  class="mt-1 w-40 rounded-xl border border-brand-200 bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label for="venue-lng" class="block text-xs font-semibold text-brand-900">
                  {{ t('admin.venueLngLabel') }}
                </label>
                <input
                  id="venue-lng"
                  v-model.number="tenant.settings.venue.lng"
                  type="number"
                  step="0.000001"
                  class="mt-1 w-40 rounded-xl border border-brand-200 bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label for="venue-radius" class="block text-xs font-semibold text-brand-900">
                  {{ t('admin.venueRadiusLabel') }}
                </label>
                <input
                  id="venue-radius"
                  v-model.number="tenant.settings.venue.radiusMeters"
                  type="number"
                  min="1"
                  max="50000"
                  class="mt-1 w-28 rounded-xl border border-brand-200 bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-3">
              <BaseButton variant="secondary" :disabled="venueLocating" @click="useMyLocation">
                {{ venueLocating ? t('admin.venueLocating') : t('admin.venueUseLocation') }}
              </BaseButton>
              <p v-if="venueError" class="text-xs font-medium text-red-600">
                {{ t('admin.venueLocationFailed') }}
              </p>
            </div>

            <p class="text-xs text-muted">{{ t('admin.venuePrivacyNote') }}</p>
          </div>
        </fieldset>

        <fieldset>
          <legend class="text-sm font-bold uppercase tracking-wide text-brand-900">
            {{ t('admin.typefaceHeading') }}
          </legend>
          <p class="mt-0.5 text-xs text-muted">{{ t('admin.typefaceHelp') }}</p>

          <label for="font-family" class="mt-2 block text-sm font-semibold text-brand-900">
            {{ t('admin.typefaceLabel') }}
          </label>
          <select
            id="font-family"
            v-model="tenant.settings.fontFamily"
            class="mt-1 w-full rounded-xl border border-brand-200 bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500"
          >
            <option v-for="choice in FONT_CHOICES" :key="choice" :value="choice">
              {{ FONTS[choice].label }}
            </option>
          </select>

          <!-- The preview uses the live font because the store applies it on
               change, so what you read here is what fans get. -->
          <p class="mt-3 rounded-xl bg-surface p-3 text-lg text-brand-900 ring-1 ring-brand-100">
            {{ t('admin.typefacePreview') }}
          </p>
        </fieldset>

        <fieldset class="space-y-5">
          <legend class="text-sm font-bold uppercase tracking-wide text-brand-900">
            {{ t('admin.paletteHeading') }}
          </legend>

          <ColorField
            v-model="tenant.settings.brandBase"
            :label="t('admin.brandLabel')"
            :help="t('admin.brandHelp')"
            :ramp="tenant.brandRamp"
          />

          <ColorField
            v-model="tenant.settings.accentBase"
            :label="t('admin.accentLabel')"
            :help="t('admin.accentHelp')"
            :ramp="tenant.accentRamp"
          />
        </fieldset>

        <fieldset>
          <legend class="text-sm font-bold uppercase tracking-wide text-brand-900">
            {{ t('admin.contrastHeading') }}
          </legend>
          <p class="mt-0.5 text-xs text-muted">{{ t('admin.contrastHelp') }}</p>

          <ul class="mt-3 space-y-2">
            <li
              v-for="check in contrastChecks"
              :key="check.stop"
              class="flex items-center gap-3 rounded-xl bg-surface p-2.5 ring-1 ring-brand-100"
            >
              <span
                class="flex h-10 w-24 shrink-0 items-center justify-center rounded-lg text-xs font-semibold text-white"
                :style="{ backgroundColor: check.hex }"
              >
                Aa
              </span>
              <div class="min-w-0 flex-1">
                <p class="text-xs font-medium text-brand-900">
                  {{ t('admin.contrastOn', { stop: check.stop }) }}
                </p>
                <p class="text-xs text-muted">
                  {{ t('admin.contrastRatio', { ratio: check.ratio }) }}
                </p>
              </div>
              <span
                class="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                :class="gradeClass(check.grade)"
              >
                {{ t(check.gradeKey) }}
              </span>
            </li>
          </ul>
        </fieldset>

        <TenantImagesField />
      </div>

      <!-- ── Live preview ──────────────────────────────────────── -->
      <aside class="lg:sticky lg:top-24 lg:self-start">
        <h2 class="text-sm font-bold uppercase tracking-wide text-brand-900">
          {{ t('admin.previewHeading') }}
        </h2>
        <p class="mt-0.5 mb-3 text-xs text-muted">{{ t('admin.previewHelp') }}</p>
        <PhonePreview />
      </aside>
    </div>

    <AdminDiagnostics class="mt-8" />
  </section>
</template>
