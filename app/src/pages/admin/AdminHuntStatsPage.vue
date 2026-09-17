<script setup lang="ts">
/**
 * Per-hunt analytics for staff.
 *
 * Two layers, kept distinct on purpose:
 *  - AGGREGATE (`campaign_stats/`): counters, never a person — headline
 *    numbers, derived rates, the hourly timeline, and the per-mission
 *    breakdown. This is "how many / when / which mission".
 *  - FINISHER LEDGER (`campaign_participants/`): a per-person list, earliest
 *    finish first — "who, and in what order". SERVER-authoritative (the server
 *    tallies verified captures) and GUEST-INCLUSIVE; the order is real, not a
 *    self-report. Each row is a pseudonymous participant id shown as the fan's
 *    claim code, so staff match a winner at the counter — not prize authority
 *    on its own (see docs/architecture.md § Seams). A load failure here leaves
 *    the aggregate dashboard intact rather than failing the whole page.
 */
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { deriveClaimCode, type CampaignFinisher, type CampaignStats } from 'shared'
import LoadingLine from '../../components/LoadingLine.vue'
import { useHuntsStore } from '../../stores/hunts'
import { useTenantStore } from '../../stores/tenant'
import { useMissionText } from '../../lib/missionText'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const hunts = useHuntsStore()
const tenant = useTenantStore()
const { resolve: resolveMissionText } = useMissionText()

const huntId = computed(() => String(route.params.id))
const huntName = computed(() => hunts.current?.name ?? '')

const stats = ref<CampaignStats | null>(null)
const finishers = ref<CampaignFinisher[]>([])
const loading = ref(true)
const failed = ref(false)

onMounted(async () => {
  loading.value = true
  failed.value = false
  // Name and mission titles from the campaign doc; numbers from the stats doc.
  await hunts.loadOne(huntId.value)
  const result = await hunts.loadStats(huntId.value)
  if (result) stats.value = result
  else failed.value = true
  // Finishers are secondary: a failure here must not blank the dashboard, so
  // it is loaded after and its result simply left empty on failure.
  const wall = await hunts.loadFinishers(huntId.value)
  if (wall) finishers.value = wall
  loading.value = false
})

/** A percentage string, or an em dash when there is nothing to divide by so a
 *  brand-new hunt reads "—" rather than a misleading "0%" or a NaN. */
function ratio(numerator: number, denominator: number): string {
  if (denominator <= 0) return '—'
  return `${Math.min(100, Math.round((numerator / denominator) * 100))}%`
}

// ── Headline numbers ────────────────────────────────────────────────
// Order is most-human-first: people, then what they did, then the two rates
// that turn raw counts into "how well did it go". Matches is set apart from
// captures so staff read "badges earned" as the success signal.
const tiles = computed(() => {
  const s = stats.value
  if (!s) return []
  return [
    { key: 'participants', label: t('hunts.statsParticipants'), help: t('hunts.statsParticipantsHelp'), value: String(s.participants) },
    { key: 'completions', label: t('hunts.statsCompletions'), help: t('hunts.statsCompletionsHelp'), value: String(s.completions) },
    { key: 'conversion', label: t('hunts.statsConversion'), help: t('hunts.statsConversionHelp'), value: ratio(s.completions, s.participants) },
    { key: 'matches', label: t('hunts.statsMatches'), help: t('hunts.statsMatchesHelp'), value: String(s.matches) },
    { key: 'captures', label: t('hunts.statsCaptures'), help: t('hunts.statsCapturesHelp'), value: String(s.captures) },
    { key: 'accuracy', label: t('hunts.statsAccuracy'), help: t('hunts.statsAccuracyHelp'), value: ratio(s.matches, s.captures) },
  ]
})

const hasActivity = computed(() => {
  const s = stats.value
  return !!s && (s.participants + s.captures + s.completions > 0 || finishers.value.length > 0)
})

// ── Per-mission breakdown ────────────────────────────────────────────
// Join the aggregate per-mission counters onto the hunt's current mission
// list, so each row is labelled with the title staff wrote (and seeded titles
// resolve through the i18n key). Counters whose mission was since removed are
// kept at the end — the plays happened, and dropping them would silently
// understate the totals. Bars are relative to the most-attempted mission so
// the hardest/easiest read at a glance.
const missionRows = computed(() => {
  const counters = stats.value?.missions ?? {}
  const missions = hunts.current?.missions ?? []
  const known = new Set(missions.map((m) => m.id))

  const rows = missions.map((m, i) => {
    const c = counters[m.id] ?? { captures: 0, matches: 0 }
    return { id: m.id, label: resolveMissionText(m.title), order: i + 1, removed: false, ...c }
  })
  for (const [id, c] of Object.entries(counters)) {
    if (!known.has(id)) {
      rows.push({ id, label: t('hunts.statsMissionRemoved'), order: 0, removed: true, ...c })
    }
  }

  const max = rows.reduce((m, r) => Math.max(m, r.captures), 0)
  return rows.map((r) => ({
    ...r,
    pct: max > 0 ? Math.max(4, Math.round((r.captures / max) * 100)) : 0,
    rate: r.captures > 0 ? Math.round((r.matches / r.captures) * 100) : 0,
  }))
})

const hasMissionData = computed(() => missionRows.value.some((r) => r.captures > 0))

// A fuller instant than the hourly timeline: finishers want a date and a
// minute, still rendered in the club's timezone (falling back to the viewer's
// on a bad tz, exactly like the timeline formatter).
const finishedFormat = computed(() => {
  const opts: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }
  try {
    return new Intl.DateTimeFormat(undefined, { ...opts, timeZone: tenant.settings.timezone })
  } catch {
    return new Intl.DateTimeFormat(undefined, opts)
  }
})

function formatFinished(epochMs: number): string {
  return finishedFormat.value.format(new Date(epochMs))
}

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

    <LoadingLine v-if="loading" class="mt-8" />

    <p
      v-else-if="failed"
      class="mt-6 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
    >
      {{ t('hunts.statsLoadFailed') }}
    </p>

    <p v-else-if="!hasActivity" class="mt-8 text-sm text-muted">{{ t('hunts.statsEmpty') }}</p>

    <template v-else>
      <!-- ── Headline numbers ─────────────────────────────────────── -->
      <dl class="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
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

      <!-- ── Per-mission breakdown ────────────────────────────────── -->
      <section class="mt-8">
        <h2 class="text-sm font-bold uppercase tracking-wide text-brand-900">
          {{ t('hunts.statsMissionsHeading') }}
        </h2>
        <p class="mt-0.5 text-xs text-muted">{{ t('hunts.statsMissionsHelp') }}</p>

        <p v-if="!hasMissionData" class="mt-3 text-sm text-muted">
          {{ t('hunts.statsMissionsEmpty') }}
        </p>

        <ul v-else class="mt-3 space-y-3">
          <li
            v-for="row in missionRows"
            :key="row.id"
            :aria-label="`${row.label}: ${t('hunts.statsMissionMeta', { count: row.captures, percent: row.rate })}`"
          >
            <div class="flex items-baseline justify-between gap-3">
              <span
                class="truncate text-sm font-semibold text-brand-900"
                :class="{ italic: row.removed }"
                :translate="row.removed ? undefined : 'no'"
              >
                <span v-if="!row.removed" class="mr-1 font-mono text-xs text-muted">{{ row.order }}.</span>
                {{ row.label }}
              </span>
              <span class="shrink-0 text-xs text-muted tabular-nums">
                {{ t('hunts.statsMissionMeta', { count: row.captures, percent: row.rate }) }}
              </span>
            </div>
            <!-- Bar shows attempts (captures); the filled portion is the share
                 that matched, so a wide-but-mostly-empty bar is the mission
                 people keep trying and failing. -->
            <span class="mt-1 block h-3 overflow-hidden rounded-full bg-brand-50" :style="{ width: `${row.pct}%` }">
              <span class="block h-full rounded-full bg-brand-500" :style="{ width: `${row.rate}%` }" />
            </span>
          </li>
        </ul>
      </section>

      <!-- ── Finishers (signed-in, self-reported) ─────────────────── -->
      <section class="mt-8">
        <h2 class="text-sm font-bold uppercase tracking-wide text-brand-900">
          {{ t('hunts.statsFinishersHeading') }}
        </h2>
        <p class="mt-0.5 text-xs text-muted">{{ t('hunts.statsFinishersHelp') }}</p>

        <p v-if="!finishers.length" class="mt-3 text-sm text-muted">
          {{ t('hunts.statsFinishersEmpty') }}
        </p>

        <ol v-else class="mt-3 space-y-1.5">
          <li
            v-for="(finisher, index) in finishers"
            :key="finisher.participantId"
            class="flex items-center gap-3 rounded-lg px-2 py-1.5"
            :class="index === 0 ? 'bg-accent-50 ring-1 ring-accent-200' : ''"
          >
            <span
              class="grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold tabular-nums"
              :class="index === 0 ? 'bg-accent-500 text-white' : 'bg-brand-100 text-brand-700'"
            >
              {{ index + 1 }}
            </span>
            <!-- The claim code is the fan-facing handle: it is exactly what the
                 fan sees in their app, so staff match it at the prize counter. -->
            <span class="shrink-0 font-mono text-sm font-semibold text-brand-900" translate="no">
              {{ t('hunts.statsFinisherCode', { code: deriveClaimCode(finisher.participantId) }) }}
            </span>
            <span
              class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
              :class="finisher.isGuest ? 'bg-brand-50 text-brand-600' : 'bg-green-50 text-green-700'"
            >
              {{ finisher.isGuest ? t('hunts.statsFinisherGuest') : t('hunts.statsFinisherFan') }}
            </span>
            <span class="ml-auto shrink-0 text-xs text-muted" translate="no">
              {{ t('hunts.statsFinisherFinished', { when: formatFinished(finisher.finishedAt) }) }}
            </span>
          </li>
        </ol>

        <p class="mt-2 text-[11px] text-muted">{{ t('hunts.statsFinishersCodeNote') }}</p>
      </section>

      <p class="mt-8 text-xs text-muted">{{ t('hunts.statsPrivacyNote') }}</p>
    </template>
  </section>
</template>
