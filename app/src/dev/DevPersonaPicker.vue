<script setup lang="ts">
/**
 * Dev-only persona shortcuts, rendered inline on the entry screen.
 *
 * This replaced a floating overlay pill. The pill was discoverable only if
 * you already knew it was there — "how do I switch users" has to be
 * answerable by looking at the screen where you choose who to be.
 *
 * Eliminated from production: EntryPage resolves this through a dynamic
 * import inside an `import.meta.env.DEV` branch. See CLAUDE.md § Dev tooling.
 */
import { useRouter } from 'vue-router'
import { DEV_PERSONAS, type DevPersona } from './personas'
import { useMissionsStore } from '../stores/missions'
import { useProgressStore } from '../stores/progress'
import { useSessionStore } from '../stores/session'

const router = useRouter()
const progress = useProgressStore()
const missionsStore = useMissionsStore()
const session = useSessionStore()

function apply(persona: DevPersona): void {
  const target = missionsStore.badgeTarget
  const wanted = persona.badgeCount(target)

  // Real mission ids, so the trophy case renders actual badges.
  progress.nickname = persona.nickname
  progress.avatar = persona.avatar
  progress.earnedIds = missionsStore.missions.slice(0, wanted).map((m) => m.id)
  progress.redeemed = persona.redeemed ?? false

  session.continueAsGuest()
  void router.push({ name: 'home' })
}
</script>

<template>
  <div class="rounded-xl border border-slate-700 bg-slate-900 p-3 text-slate-100">
    <p class="text-[11px] font-bold uppercase tracking-wide">🧪 Dev shortcuts</p>
    <p class="mt-0.5 text-[10px] text-slate-400">
      Emulator only. Sign in as a fan at a given progress state.
    </p>

    <ul class="mt-2.5 space-y-1">
      <li v-for="persona in DEV_PERSONAS" :key="persona.id">
        <button
          type="button"
          class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-800"
          @click="apply(persona)"
        >
          <span aria-hidden="true" class="text-sm leading-none">{{ persona.emoji }}</span>
          <span class="flex-1 text-[11px] font-semibold">{{ persona.label }}</span>
          <span class="font-mono text-[10px] text-slate-400">
            {{ persona.badgeCount(missionsStore.badgeTarget) }}/{{ missionsStore.badgeTarget }}
          </span>
        </button>
      </li>
    </ul>
  </div>
</template>
