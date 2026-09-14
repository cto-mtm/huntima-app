<script setup lang="ts">
/**
 * Per-hunt analytics for staff.
 *
 * Aggregate counters only — the server keeps no per-person row (see
 * docs/architecture.md § "Seams left open"), so this answers "how many / when"
 * and never "who". `participants` / `completions` are client-deduped
 * approximations; `captures` / `matches` are exact server counts.
 */
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import type { CampaignStats } from 'shared'
import { useHuntsStore } from '../../stores/hunts'
import { useTenantStore } from '../../stores/tenant'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const hunts = useHuntsStore()
const tenant = useTenantStore()

const huntId = computed(() => String(route.params.id))
const huntName = computed(() => hunts.current?.name ?? '')

const stats = ref<CampaignStats | null>(null)
const loading = ref(true)
const failed = ref(false)

onMounted(async () => {
  loading.value = true
  failed.value = false
  // Name from the campaign doc; numbers from the stats doc.
  await hunts.loadOne(huntId.value)
  const result = await hunts.loadStats(huntId.value)
  if (result) stats.value = result
  else failed.value = true
  loading.value = false
})

// ── Headline numbers ────────────────────────────────────────────────
// Order is most-human-first: people, then what they did. Matches is set
// apart from captures so staff read "badges earned" as the success signal.
const tiles = computed(() => {
  const s = stats.value
  if (!s) return []
  return [
    { key: 'participants', label: t('hunts.statsParticipants'), help: t('hunts.statsParticipantsHelp'), value: s.participants },
    { key: 'completions', label: t('hunts.statsCompletions'), help: t('hunts.statsCompletionsHelp'), value: s.completions },
    { key: 'matches', label: t('hunts.statsMatches'), help: t('hunts.statsMatchesHelp'), value: s.matches },
    { key: 'captures', label: t('hunts.statsCaptures'), help: t('hunts.statsCapturesHelp'), value: s.captures },
  ]
})

const hasActivity = computed(() => {
  const s = stats.value
  return !!s && s.participants + s.captures + s.completions > 0
})

// ── Timeline ────────────────────────────────────────────────────────
// Buckets are UTC hours; render them in the club's timezone so staff read
// game-local time. A bad tz string must not blank the page, so fall back to
// the viewer's locale zone.
const hourFormat = computed(() => {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', hour: 'numeric' }
  try {
    return new Intl.DateTimeFormat(undefined, { ...opts, timeZone: tenant.settings.timezone })
  } catch {
    return new Intl.DateTimeFormat(undefined, opts)
  }
})

function formatHour(bucket: string): string {
  // "YYYY-MM-DDTHH" → a real instant at the top of that UTC hour.
  return hourFormat.value.format(new Date(`${bucket}:00:00Z`))
}

const timeline = computed(() => {
  const hours = stats.value?.hours ?? {}
  const entries = Object.entries(hours)
    .filter(([, count]) => count > 0)
    .sort(([a], [b]) => a.localeCompare(b))
  const max = entries.reduce((m, [, c]) => Math.max(m, c), 0)
  return entries.map(([bucket, count]) => ({
    bucket,
    label: formatHour(bucket),
    count,
    // Width relative to the busiest hour, so the shape reads at a glance.
    pct: max > 0 ? Math.max(4, Math.round((count / max) * 100)) : 0,
  }))
})
</script>

<template>
  <section class="py-5">
    <header class="mt-5">
      <button
        type="button"
        class="text-xs font-semibold text-brand-600"
        @click="router.push({ name: 'admin-hunts' })"
      >
        ← {{ t('hunts.backToHunts') }}
      </button>
      <h1 class="mt-1 text-2xl font-extrabold text-brand-900" translate="no">
        {{ huntName }}
      </h1>
      <p class="mt-1 text-sm text-muted">{{ t('hunts.statsSubtitle') }}</p>
    </header>

    <p v-if="loading" class="mt-8 text-sm text-muted">{{ t('common.loading') }}</p>

    <p
      v-else-if="failed"
      class="mt-6 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
    >
      {{ t('hunts.statsLoadFailed') }}
    </p>

    <p v-else-if="!hasActivity" class="mt-8 text-sm text-muted">{{ t('hunts.statsEmpty') }}</p>

    <template v-else>
      <!-- ── Headline numbers ─────────────────────────────────────── -->
      <dl class="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div
          v-for="tile in tiles"
          :key="tile.key"
          class="rounded-card bg-surface p-4 shadow-sm ring-1 ring-brand-100"
        >
          <dd class="text-3xl font-extrabold tabular-nums text-brand-900">{{ tile.value }}</dd>
          <dt class="mt-1 text-xs font-bold uppercase tracking-wide text-brand-900">
            {{ tile.label }}
          </dt>
          <p class="mt-0.5 text-[11px] text-muted">{{ tile.help }}</p>
        </div>
      </dl>

      <!-- ── When they played ─────────────────────────────────────── -->
      <section class="mt-8">
        <h2 class="text-sm font-bold uppercase tracking-wide text-brand-900">
          {{ t('hunts.statsTimelineHeading') }}
        </h2>
        <p class="mt-0.5 text-xs text-muted">
          {{ t('hunts.statsTimelineHelp', { timezone: tenant.settings.timezone }) }}
        </p>

        <p v-if="!timeline.length" class="mt-3 text-sm text-muted">
          {{ t('hunts.statsTimelineEmpty') }}
        </p>

        <ul v-else class="mt-3 space-y-1.5">
          <li
            v-for="row in timeline"
            :key="row.bucket"
            class="flex items-center gap-3"
            :aria-label="`${row.label}: ${row.count}`"
          >
            <span class="w-32 shrink-0 text-xs text-muted" translate="no">{{ row.label }}</span>
            <span class="h-3 flex-1 overflow-hidden rounded-full bg-brand-50">
              <span
                class="block h-full rounded-full bg-brand-500"
                :style="{ width: `${row.pct}%` }"
              />
            </span>
            <span class="w-8 shrink-0 text-right text-xs font-semibold tabular-nums text-brand-900">
              {{ row.count }}
            </span>
          </li>
        </ul>
      </section>

      <p class="mt-8 text-xs text-muted">{{ t('hunts.statsPrivacyNote') }}</p>
    </template>
  </section>
</template>
