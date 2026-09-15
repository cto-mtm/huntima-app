<script setup lang="ts">
/**
 * The collection: everything this fan has to show for playing.
 *
 * Three things, in the order they matter — the shelf of hunts WON, the badge
 * series still filling up, and the dated journey that produced both. A trophy
 * is a finished hunt; a badge is one capture inside a hunt. Keeping those
 * distinct is what makes this page a record rather than a second hub.
 *
 * ── What is NOT here, and why ─────────────────────────────────
 * The mockups also ask for a leaderboard, scout points, a user level and
 * rarity percentages. None of them are built. Every one needs a per-fan row
 * on the server — a ranked table of who collected what — and this app
 * deliberately stores aggregate counters instead, because its players are
 * children at a public venue (docs/architecture.md § Seams left open). A
 * leaderboard is not a UI feature with a backend attached; it is a decision
 * about storing behavioural data on minors, and it belongs in its own change.
 *
 * Everything on this page is derived from what the device already knows:
 * badges per campaign, hunts joined, hunts won.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import BaseButton from '../components/BaseButton.vue'
import EmptyState from '../components/EmptyState.vue'
import RewardMedallion, { type RewardTier } from '../components/reward/RewardMedallion.vue'
import TrophyShelf, { type ShelfTrophy } from '../components/reward/TrophyShelf.vue'
import { useProgressStore } from '../stores/progress'
import { useSessionStore } from '../stores/session'
import { useTenantStore } from '../stores/tenant'

const { t, d } = useI18n()
const route = useRoute()
const router = useRouter()
const progress = useProgressStore()
const session = useSessionStore()
const tenant = useTenantStore()

/**
 * This page is GLOBAL, but the redeem CTA targets a tenant route — a prize
 * is collected at a venue. `progress.isComplete` refers to the last loaded
 * hunt, which belongs to the last-visited org, so that slug is the right
 * target; with no slug ever visited there is no hunt to have completed.
 */
const redeemSlug = computed(() => {
  const p = route.params.tenantSlug
  return typeof p === 'string' ? p : tenant.lastSlug
})

function goRedeem(): void {
  if (redeemSlug.value) {
    void router.push({ name: 'redeem', params: { tenantSlug: redeemSlug.value } })
  }
}

/** Badges earned across every hunt this fan has ever played. */
const totalBadges = computed(() =>
  Object.values(progress.earned).reduce((sum, ids) => sum + ids.length, 0),
)

/**
 * A trophy's metal reflects how big the hunt was: a three-mission wedding
 * hunt is not the same afternoon as a ten-mission ballpark hunt, and a shelf
 * where every cup is identical says nothing about either.
 *
 * The size comes from the joined-hunt record, which is where `badgeTarget`
 * lives. A trophy with no matching join (an older device, a cleared cache)
 * falls back to gold — the fallback has to flatter, never demote: nobody
 * should watch a trophy they earned turn to bronze because a cache expired.
 */
function tierFor(campaignId: string): RewardTier {
  const target = progress.joinedHunts.find((h) => h.campaignId === campaignId)?.badgeTarget
  if (target === undefined) return 'gold'
  if (target < 5) return 'bronze'
  if (target < 10) return 'silver'
  return 'gold'
}

/** Ranked for the podium: biggest hunts first, then most recent. */
const shelf = computed<ShelfTrophy[]>(() => {
  const weight: Record<RewardTier, number> = { rare: 4, gold: 3, silver: 2, bronze: 1, locked: 0 }
  return [...progress.trophies]
    .map((trophy) => ({
      id: trophy.campaignId,
      name: trophy.name,
      tier: tierFor(trophy.campaignId),
    }))
    .sort((a, b) => weight[b.tier] - weight[a.tier])
    .slice(0, 3)
})

/**
 * One row per hunt played — the "series" of the mockups. The slots are real:
 * the fan's badge count for that campaign, against the target that hunt set.
 * Mission NAMES are not available for a hunt that is not currently loaded, so
 * the slots are unnamed medallions rather than fabricated labels.
 */
const series = computed(() =>
  [...progress.joinedHunts]
    .sort((a, b) => b.joinedAt - a.joinedAt)
    .map((hunt) => {
      const count = progress.earned[hunt.campaignId]?.length ?? 0
      return {
        ...hunt,
        count: Math.min(count, hunt.badgeTarget),
        won: progress.trophies.some((trophy) => trophy.campaignId === hunt.campaignId),
      }
    }),
)

/**
 * The journey: every dated thing that happened, newest first.
 *
 * Built from the two timestamps the device already keeps — when a hunt was
 * joined and when it was won. No new tracking, no event log: if it is not
 * already stored for a functional reason, it does not appear here.
 */
const journey = computed(() => {
  const entries = [
    ...progress.joinedHunts.map((hunt) => ({
      id: `join-${hunt.campaignId}`,
      kind: 'joined' as const,
      name: hunt.teamName,
      at: hunt.joinedAt,
    })),
    ...progress.trophies.map((trophy) => ({
      id: `win-${trophy.campaignId}`,
      kind: 'won' as const,
      name: trophy.name,
      at: trophy.wonAt,
    })),
  ]
  return entries.sort((a, b) => b.at - a.at).slice(0, 12)
})

const hasAnything = computed(() => series.value.length > 0 || progress.trophies.length > 0)
</script>

<template>
  <section class="py-5">
    <h1 class="display-title display-title--sm text-3xl">{{ t('trophyCase.title') }}</h1>
    <div
      class="mt-1.5 h-1.5 w-16 -skew-x-12 rounded-full bg-gradient-to-r from-accent-400 to-accent-alt-500"
      aria-hidden="true"
    />

    <!-- ── Stat tiles ───────────────────────────────────────────
         Two numbers, both countable by hand from the rest of the page. A
         stat a fan cannot verify is a stat they stop believing. -->
    <div v-if="hasAnything" class="mt-5 grid grid-cols-2 gap-2.5">
      <div class="rounded-card bg-surface p-4 shadow-md shadow-brand-900/5 ring-1 ring-brand-100">
        <p class="text-3xl font-black leading-none text-brand-900">{{ totalBadges }}</p>
        <p class="mt-1 text-xs font-bold uppercase tracking-wide text-muted">
          {{ t('trophyCase.statBadges') }}
        </p>
      </div>
      <div class="rounded-card bg-surface p-4 shadow-md shadow-brand-900/5 ring-1 ring-brand-100">
        <p class="text-3xl font-black leading-none text-brand-900">{{ progress.trophies.length }}</p>
        <p class="mt-1 text-xs font-bold uppercase tracking-wide text-muted">
          {{ t('trophyCase.statHunts') }}
        </p>
      </div>
    </div>

    <!-- Guests keep progress on this device only. Nudge them to sign in so a
         cleared browser or a new phone doesn't wipe their trophies. -->
    <div
      v-if="session.isGuest"
      class="mt-4 rounded-card bg-brand-50 p-4 ring-1 ring-brand-100"
    >
      <p class="text-sm font-semibold text-brand-900">{{ t('trophyCase.guestPromptTitle') }}</p>
      <p class="mt-1 text-xs text-muted">{{ t('trophyCase.guestPromptBody') }}</p>
      <div class="mt-3">
        <BaseButton size="md" @click="$router.push({ name: 'signin' })">
          {{ t('trophyCase.guestPromptCta') }}
        </BaseButton>
      </div>
    </div>

    <!-- ── The shelf ────────────────────────────────────────────
         Shown with empty plinths too: a case with room on it is an
         invitation, and a fan who has joined a hunt but not finished one
         should be able to see exactly what winning looks like. -->
    <template v-if="hasAnything">
      <h2 class="mt-7 text-xl font-extrabold uppercase italic tracking-tight text-brand-900">
        {{ t('trophyCase.earnedHeading') }}
      </h2>
      <TrophyShelf class="mt-3" :trophies="shelf" />
      <p v-if="!progress.trophies.length" class="mt-2 text-xs text-muted">
        {{ t('trophyCase.shelfEmptyHint') }}
      </p>
    </template>

    <EmptyState
      v-else
      shape="cup"
      :title="t('trophyCase.emptyTitle')"
      :body="t('trophyCase.empty')"
    />

    <!-- ── Series ───────────────────────────────────────────────
         One row per hunt played, with its real badge count against its real
         target. The slots carry no names: a hunt that is not currently
         loaded has no mission list on this device, and inventing labels for
         the empty ones would be fiction. -->
    <template v-if="series.length">
      <h2 class="mt-8 text-xl font-extrabold uppercase italic tracking-tight text-brand-900">
        {{ t('trophyCase.seriesHeading') }}
      </h2>
      <ul class="mt-3 grid gap-2.5">
        <li
          v-for="hunt in series"
          :key="hunt.campaignId"
          class="rounded-card bg-surface p-4 shadow-md shadow-brand-900/5 ring-1 ring-brand-100"
        >
          <div class="flex items-baseline justify-between gap-2">
            <h3 class="truncate font-bold text-brand-900" translate="no">{{ hunt.teamName }}</h3>
            <p
              class="shrink-0 text-xs font-extrabold"
              :class="hunt.won ? 'text-success-700' : 'text-accent-600'"
            >
              {{ t('trophyCase.seriesCount', { count: hunt.count, total: hunt.badgeTarget }) }}
            </p>
          </div>
          <div class="mt-2.5 flex flex-wrap gap-1.5">
            <RewardMedallion
              v-for="i in hunt.badgeTarget"
              :key="i"
              shape="rosette"
              :tier="i <= hunt.count ? 'gold' : 'locked'"
              :emblem="i <= hunt.count ? 'badge' : undefined"
              class="size-8"
            />
          </div>
        </li>
      </ul>
    </template>

    <!-- ── Journey ──────────────────────────────────────────────
         A spine with dated nodes. Built only from timestamps already kept
         for functional reasons — joining a hunt and winning it. -->
    <template v-if="journey.length">
      <h2 class="mt-8 text-xl font-extrabold uppercase italic tracking-tight text-brand-900">
        {{ t('trophyCase.journeyHeading') }}
      </h2>
      <ol class="relative mt-3 pl-7">
        <!-- The spine, behind the nodes. Decorative: the list is already a
             list, with or without a line drawn down it. -->
        <span
          class="absolute bottom-3 left-[0.6875rem] top-3 w-0.5 rounded-full bg-brand-100"
          aria-hidden="true"
        />
        <li v-for="entry in journey" :key="entry.id" class="relative py-2">
          <span
            class="absolute -left-7 top-2.5 flex size-6 items-center justify-center rounded-full ring-4 ring-canvas"
            :class="entry.kind === 'won' ? 'bg-tier-gold-500' : 'bg-brand-200'"
            aria-hidden="true"
          >
            <AppIcon
              :name="entry.kind === 'won' ? 'trophies' : 'missions'"
              class="size-3.5"
              :class="entry.kind === 'won' ? 'text-white' : 'text-brand-700'"
            />
          </span>
          <p class="text-sm font-bold text-brand-900" translate="no">{{ entry.name }}</p>
          <p class="text-xs text-muted">
            {{ t(entry.kind === 'won' ? 'trophyCase.journeyWon' : 'trophyCase.journeyJoined') }}
            ·
            {{ d(new Date(entry.at), 'short') }}
          </p>
        </li>
      </ol>
    </template>

    <!-- A win the fan hasn't claimed yet: send them to the prize screen. -->
    <div v-if="progress.isComplete && !progress.redeemed && redeemSlug" class="mt-8">
      <BaseButton size="lg" icon="prize" @click="goRedeem">
        {{ t('trophyCase.complete') }}
      </BaseButton>
    </div>
  </section>
</template>
