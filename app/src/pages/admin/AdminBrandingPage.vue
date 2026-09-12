<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '../../components/BaseButton.vue'
import ColorField from '../../components/admin/ColorField.vue'
import PhonePreview from '../../components/admin/PhonePreview.vue'
import { contrastRatio, gradeContrast, type ContrastGrade } from '../../lib/color'
import { useTenantStore } from '../../stores/tenant'
import AdminNav from '../../components/admin/AdminNav.vue'
import TenantImagesField from '../../components/admin/TenantImagesField.vue'

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

function confirmReset(): void {
  if (window.confirm(t('admin.resetConfirm'))) tenant.reset()
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

    <p class="mt-4 rounded-lg bg-accent-500/10 px-3 py-2 text-xs font-medium text-accent-600">
      {{ t('admin.storageNote') }}
    </p>

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

        <div>
          <BaseButton variant="secondary" :disabled="tenant.isDefault" @click="confirmReset">
            {{ t('admin.reset') }}
          </BaseButton>
        </div>
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
  </section>
</template>
