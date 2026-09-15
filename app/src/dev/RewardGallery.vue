<script setup lang="ts">
/**
 * Dev shortcut: every piece of reward art, every tier, on both grounds.
 *
 * A reward set is a SYSTEM — the thing that goes wrong is one shape drifting
 * away from the rest, and you cannot see that by opening the page where each
 * one happens to live. This is the one screen where the whole matrix is on
 * top of itself.
 *
 * Reachable at /dev/rewards, and only in a dev build: the route itself is
 * inside an `import.meta.env.DEV` branch in the router, so Rollup drops both
 * the route and this chunk from a production bundle. See CLAUDE.md § Dev
 * tooling — strings here are deliberately untranslated.
 */
import { ref } from 'vue'
import RewardMedallion, {
  type RewardShape,
  type RewardTier,
} from '../components/reward/RewardMedallion.vue'
import RewardChest from '../components/reward/RewardChest.vue'
import TrophyShelf from '../components/reward/TrophyShelf.vue'
import HuntimaMark from '../components/HuntimaMark.vue'

const SHAPES: RewardShape[] = [
  'rosette',
  'medal',
  'ribbon',
  'cup',
  'ticket',
  'keychain',
  'pin',
  'lens',
]
const TIERS: RewardTier[] = ['locked', 'bronze', 'silver', 'gold', 'rare']

const chestOpen = ref(false)
const shelfCount = ref(3)

const shelf = [
  { id: 'a', name: 'Opening Night', tier: 'gold' as RewardTier },
  { id: 'b', name: 'Riverdogs Season Hunt', tier: 'silver' as RewardTier },
  { id: 'c', name: 'Wedding', tier: 'bronze' as RewardTier },
]
</script>

<template>
  <div class="min-h-dvh bg-canvas px-4 py-8">
    <div class="mx-auto max-w-3xl">
      <h1 class="display-title text-3xl">Reward art</h1>
      <p class="mt-2 text-sm text-muted">
        Dev shortcut. Every shape × tier. Metals are platform-fixed; the crest
        follows the tenant accent, so switch brands at /admin/branding and this
        whole grid should re-skin without the metals moving.
      </p>

      <!-- ── The matrix ───────────────────────────────────────── -->
      <div class="mt-8 overflow-x-auto">
        <table class="w-full min-w-[34rem] border-collapse">
          <thead>
            <tr>
              <th class="p-2 text-left text-xs font-bold uppercase text-muted">shape</th>
              <th
                v-for="tier in TIERS"
                :key="tier"
                class="p-2 text-xs font-bold uppercase text-muted"
              >
                {{ tier }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="shape in SHAPES" :key="shape" class="border-t border-brand-100">
              <td class="p-2 text-xs font-bold text-brand-900">{{ shape }}</td>
              <td v-for="tier in TIERS" :key="tier" class="p-2 text-center">
                <RewardMedallion :shape="shape" :tier="tier" emblem="badge" class="size-14" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ── On the dark ground ───────────────────────────────── -->
      <h2 class="mt-10 text-lg font-extrabold text-brand-900">On the showcase ground</h2>
      <p class="mt-1 text-xs text-muted">
        Gold and the rare foil are the two that change most between grounds —
        if they read here and above, they read everywhere.
      </p>
      <div class="showcase mt-3 flex flex-wrap items-center gap-4 rounded-card p-5">
        <RewardMedallion
          v-for="tier in TIERS"
          :key="tier"
          shape="rosette"
          :tier="tier"
          emblem="badge"
          class="size-16"
        />
        <RewardMedallion shape="cup" tier="gold" class="size-16" />
        <RewardMedallion shape="ticket" tier="silver" emblem="prize" class="size-16" />
      </div>

      <!-- ── Sizes ────────────────────────────────────────────── -->
      <h2 class="mt-10 text-lg font-extrabold text-brand-900">Sizes</h2>
      <p class="mt-1 text-xs text-muted">
        The emblem tracks the frame in percentages. Watch the small end: below
        about 28px the crest is mud and the shape alone has to carry it.
      </p>
      <div class="mt-3 flex flex-wrap items-end gap-4">
        <RewardMedallion shape="rosette" tier="gold" emblem="badge" class="size-24" />
        <RewardMedallion shape="rosette" tier="gold" emblem="badge" class="size-16" />
        <RewardMedallion shape="rosette" tier="gold" emblem="badge" class="size-12" />
        <RewardMedallion shape="rosette" tier="gold" emblem="badge" class="size-8" />
        <RewardMedallion shape="rosette" tier="gold" emblem="badge" class="size-6" />
      </div>

      <!-- ── Slot content ─────────────────────────────────────── -->
      <h2 class="mt-10 text-lg font-extrabold text-brand-900">Mystery slot</h2>
      <p class="mt-1 text-xs text-muted">Default slot overrides the emblem.</p>
      <div class="mt-3 flex flex-wrap items-center gap-4">
        <RewardMedallion shape="rosette" tier="locked" class="size-16">
          <span class="text-xl font-black text-tier-locked-700">?</span>
        </RewardMedallion>
        <RewardMedallion shape="ticket" tier="locked" emblem="lock" class="size-16" />
        <RewardMedallion shape="keychain" tier="locked" emblem="lock" class="size-16" />
      </div>

      <!-- ── Chest ────────────────────────────────────────────── -->
      <h2 class="mt-10 text-lg font-extrabold text-brand-900">Chest</h2>
      <div class="mt-3 flex items-center gap-6">
        <RewardChest :open="chestOpen" class="w-32" />
        <button
          type="button"
          class="rounded-full bg-brand-600 px-4 py-2 text-sm font-bold text-white"
          @click="chestOpen = !chestOpen"
        >
          {{ chestOpen ? 'Close' : 'Open' }}
        </button>
      </div>

      <!-- ── Shelf ────────────────────────────────────────────── -->
      <h2 class="mt-10 text-lg font-extrabold text-brand-900">Trophy shelf</h2>
      <div class="mt-3">
        <TrophyShelf :trophies="shelf.slice(0, shelfCount)" />
        <div class="mt-3 flex gap-2">
          <button
            v-for="n in [0, 1, 2, 3]"
            :key="n"
            type="button"
            class="rounded-full px-3 py-1.5 text-sm font-bold"
            :class="shelfCount === n ? 'bg-brand-600 text-white' : 'bg-brand-100 text-brand-700'"
            @click="shelfCount = n"
          >
            {{ n }}
          </button>
        </div>
      </div>

      <!-- ── The mark ─────────────────────────────────────────── -->
      <h2 class="mt-10 text-lg font-extrabold text-brand-900">Huntima mark</h2>
      <p class="mt-1 text-xs text-muted">
        Platform identity: fixed colors, never tenant-themed. Replaces a 595 KB
        base64 PNG that shipped as logo.svg.
      </p>
      <div class="mt-3 flex items-end gap-4">
        <HuntimaMark class="size-24" />
        <HuntimaMark class="size-12" />
        <HuntimaMark class="size-7" />
        <HuntimaMark class="size-5" />
      </div>

      <div class="h-16" />
    </div>
  </div>
</template>
