<script setup lang="ts">
/**
 * The prize screen: what this hunt pays out, how close you are, and — once
 * you have won — the code a staff member reads across a counter.
 *
 * ── Why the collection grid is the mission set ────────────────
 * The mockups show a case of assorted rewards with locked "?" slots. The
 * tempting version of that is a rewards ladder (three badges buys a keychain,
 * five buys a voucher), and it is not built, because handing out goods needs a
 * server that owns the ledger and this one does not yet — see
 * docs/architecture.md § Seams left open. A grid of prizes nothing can
 * actually award is a screen that lies to a child.
 *
 * So the case shows what the fan is really collecting: one medallion per
 * mission in THIS hunt, struck once captured and a silhouette until then. Same
 * picture, same pull, every slot backed by something the server verified.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '../components/BaseButton.vue'
import RewardMedallion from '../components/reward/RewardMedallion.vue'
import { useTenantStore } from '../stores/tenant'
import { useProgressStore } from '../stores/progress'
import { useMissionsStore } from '../stores/missions'
import { useFanName } from '../composables/useFanName'
import { useMissionText } from '../lib/missionText'

const { t } = useI18n()
const progress = useProgressStore()
const missionsStore = useMissionsStore()
const { displayName } = useFanName()
const { resolve } = useMissionText()
const tenant = useTenantStore()

// A prize is only worth showing once it has a name — a hunt may not have one
// configured, and the seed fallback never does.
const prize = computed(() => {
  const p = missionsStore.prize
  return p && p.name.trim() ? p : null
})

const earnedCount = computed(
  () => missionsStore.missions.filter((m) => progress.hasBadge(m.id)).length,
)
</script>

<template>
  <section class="py-6">
    <!-- ── Already claimed ───────────────────────────────────────
         SEAM: `redeemed` is only ever set locally today, so nothing
         actually flips it. The staff "Redeem" action on the admin
         dashboard is what should set it, server-side — that is the
         whole anti-double-claim mechanism and it cannot live on the
         fan's device. -->
    <template v-if="progress.redeemed">
      <h1 class="text-2xl font-extrabold text-muted">{{ t('redeem.redeemedTitle') }}</h1>
      <p class="mt-2 text-sm text-muted">{{ t('redeem.redeemedBody') }}</p>
    </template>

    <!-- ── Win state ─────────────────────────────────────────────── -->
    <template v-else-if="progress.isComplete">
      <!-- The one dark surface a fan meets in the hunt flow. A win is the
           moment the app is allowed to stop being a daylight utility. -->
      <div class="showcase overflow-hidden rounded-card px-5 py-7 text-center">
        <RewardMedallion shape="cup" tier="gold" class="mx-auto size-24 drop-shadow-xl" />
        <h1 class="display-title display-title--sm display-title--on-dark mt-3 text-3xl">
          {{ t('redeem.wonTitle', { nickname: displayName }) }}
        </h1>
        <p class="mx-auto mt-2 max-w-xs text-sm text-white/80">
          {{ t('redeem.wonBody', { location: tenant.settings.prizeLocation }) }}
        </p>
      </div>

      <!-- What they won, if the hunt configured a prize. -->
      <div v-if="prize" class="mt-4 overflow-hidden rounded-card bg-surface shadow-sm ring-1 ring-brand-100">
        <img
          v-if="prize.imageUrl"
          :src="prize.imageUrl"
          alt=""
          class="h-40 w-full object-cover"
        />
        <div class="p-5">
          <p class="text-xs font-bold uppercase tracking-wide text-muted">
            {{ t('redeem.prizeHeading') }}
          </p>
          <h2 class="mt-1 text-lg font-extrabold text-brand-900" translate="no">{{ prize.name }}</h2>
          <p v-if="prize.description" class="mt-1 text-sm text-muted" translate="no">
            {{ prize.description }}
          </p>
          <p v-if="prize.winnerLimit > 0" class="mt-2 text-xs font-semibold text-accent-600">
            {{ t('redeem.prizeWinners', { count: prize.winnerLimit }) }}
          </p>
        </div>
      </div>

      <div class="mt-6 rounded-card bg-surface p-6 text-center shadow-sm ring-2 ring-accent-400">
        <p class="text-xs font-bold uppercase tracking-widest text-muted">
          {{ t('redeem.pinLabel') }}
        </p>
        <!-- Deliberately huge: a staff member reads this across a counter
             in a loud, bright concourse. -->
        <!-- An identifier, not prose: never machine-translated. -->
        <p
          class="mt-2 font-mono text-6xl font-black tracking-[0.2em] text-brand-900"
          translate="no"
        >
          {{ progress.claimCode }}
        </p>
      </div>
    </template>

    <!-- ── Locked ────────────────────────────────────────────────── -->
    <template v-else>
      <h1 class="text-2xl font-extrabold text-brand-900">{{ t('redeem.lockedTitle') }}</h1>
      <p class="mt-2 text-sm text-muted">
        {{ t('redeem.lockedBody', { remaining: progress.remaining }) }}
      </p>

      <!-- Show what they're playing for, so the prize is a reason to keep
           going rather than a surprise revealed only at the finish line. -->
      <div
        v-if="prize"
        class="mt-6 overflow-hidden rounded-card bg-surface shadow-sm ring-1 ring-brand-100"
      >
        <img
          v-if="prize.imageUrl"
          :src="prize.imageUrl"
          alt=""
          class="h-40 w-full object-cover"
        />
        <div class="p-5">
          <p class="text-xs font-bold uppercase tracking-wide text-muted">
            {{ t('redeem.prizeUpForGrabs') }}
          </p>
          <h2 class="mt-1 text-lg font-extrabold text-brand-900" translate="no">{{ prize.name }}</h2>
          <p v-if="prize.description" class="mt-1 text-sm text-muted" translate="no">
            {{ prize.description }}
          </p>
          <p v-if="prize.winnerLimit > 0" class="mt-2 text-xs font-semibold text-accent-600">
            {{ t('redeem.prizeWinners', { count: prize.winnerLimit }) }}
          </p>
        </div>
      </div>
    </template>

    <!-- ── The case ──────────────────────────────────────────────
         One slot per mission in this hunt. Earned slots wear the mission's
         own color so the case reads back as the missions it came from;
         locked slots are silhouettes with a "?", which is the whole reason
         a case beats a checklist — the empty slot is the invitation. -->
    <section v-if="missionsStore.missions.length" class="mt-8">
      <div class="flex items-baseline justify-between gap-2">
        <h2 class="text-sm font-bold uppercase tracking-wide text-brand-900">
          {{ t('redeem.caseHeading') }}
        </h2>
        <p class="text-xs font-extrabold text-accent-600">
          {{ t('redeem.caseCount', { count: earnedCount, total: missionsStore.missions.length }) }}
        </p>
      </div>

      <ul class="mt-3 grid grid-cols-4 gap-3">
        <li
          v-for="mission in missionsStore.missions"
          :key="mission.id"
          class="flex flex-col items-center gap-1"
        >
          <RewardMedallion
            shape="rosette"
            :tier="progress.hasBadge(mission.id) ? 'gold' : 'locked'"
            :crest="mission.color"
            class="size-14"
          >
            <!-- An unearned slot must not name the mission it hides: the
                 reveal IS the reward. A "?" and a shape, nothing more. -->
            <span
              v-if="!progress.hasBadge(mission.id)"
              class="text-lg font-black text-tier-locked-700"
              aria-hidden="true"
            >
              ?
            </span>
          </RewardMedallion>
          <p
            v-if="progress.hasBadge(mission.id)"
            class="line-clamp-2 text-center text-[10px] font-semibold leading-tight text-brand-900"
          >
            {{ resolve(mission.title) }}
          </p>
          <p v-else class="text-center text-[10px] font-semibold text-muted">
            {{ t('redeem.caseLocked') }}
          </p>
        </li>
      </ul>
    </section>

    <div class="mt-8">
      <BaseButton variant="secondary" size="lg" @click="$router.push({ name: 'home' })">
        {{ t('redeem.backToMissions') }}
      </BaseButton>
    </div>
  </section>
</template>
