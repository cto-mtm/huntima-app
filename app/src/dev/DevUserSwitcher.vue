<script setup lang="ts">
/**
 * Dev-only fan switcher.
 *
 * NEVER rendered in production: App.vue only resolves this component behind
 * `import.meta.env.DEV`, which Vite replaces with the literal `false` at
 * build time, so the dynamic import is eliminated rather than merely skipped.
 * Verify with: `npm run build && grep -r "Fresh arrival" app/dist` (no hits).
 *
 * It writes the progress store's refs directly instead of going through an
 * action. That is deliberate — it keeps the test-affordance in src/dev/
 * rather than adding a `applyDevState()` to product code that only this file
 * would ever call.
 */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { DEV_PERSONAS, type DevPersona } from './personas'
import { useMissionsStore } from '../stores/missions'
import { useProgressStore } from '../stores/progress'

const router = useRouter()
const progress = useProgressStore()
const missionsStore = useMissionsStore()

const open = ref(false)

const activeId = computed(() => {
  const target = missionsStore.badgeTarget
  return (
    DEV_PERSONAS.find(
      (p) =>
        p.nickname === progress.nickname &&
        p.badgeCount(target) === progress.earnedCount &&
        (p.redeemed ?? false) === progress.redeemed,
    )?.id ?? null
  )
})

function apply(persona: DevPersona): void {
  const target = missionsStore.badgeTarget
  const wanted = persona.badgeCount(target)

  // Award real mission ids from the live campaign so the trophy case renders
  // actual badges rather than orphaned slots.
  const ids = missionsStore.missions.slice(0, wanted).map((m) => m.id)

  progress.nickname = persona.nickname
  progress.avatar = persona.avatar
  progress.earnedIds = ids
  progress.redeemed = persona.redeemed ?? false

  open.value = false
}

function clearAll(): void {
  progress.reset()
  open.value = false
  void router.push({ name: 'onboarding' })
}
</script>

<template>
  <div class="fixed bottom-20 right-3 z-50 flex flex-col items-end gap-2 print:hidden">
    <!-- Panel -->
    <div
      v-if="open"
      class="w-72 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl"
    >
      <div class="flex items-center justify-between border-b border-slate-700 px-3 py-2">
        <span class="text-xs font-bold uppercase tracking-wide">Quick login</span>
        <button type="button" class="text-slate-400 hover:text-white" @click="open = false">✕</button>
      </div>

      <ul class="max-h-80 overflow-y-auto">
        <li v-for="persona in DEV_PERSONAS" :key="persona.id">
          <button
            type="button"
            class="flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-slate-800"
            :class="activeId === persona.id ? 'bg-slate-800' : ''"
            @click="apply(persona)"
          >
            <span aria-hidden="true" class="mt-0.5 text-base leading-none">{{ persona.emoji }}</span>
            <span class="min-w-0 flex-1">
              <span class="flex items-center gap-1.5">
                <span class="text-xs font-semibold">{{ persona.label }}</span>
                <span
                  v-if="activeId === persona.id"
                  class="rounded-full bg-green-500/20 px-1.5 text-[9px] font-bold uppercase text-green-300"
                >
                  active
                </span>
              </span>
              <span class="mt-0.5 block text-[10px] leading-snug text-slate-400">
                {{ persona.note }}
              </span>
              <span class="mt-0.5 block font-mono text-[10px] text-slate-500">
                {{ persona.nickname }} · {{ persona.badgeCount(missionsStore.badgeTarget) }}/{{
                  missionsStore.badgeTarget
                }}
              </span>
            </span>
          </button>
        </li>
      </ul>

      <div class="border-t border-slate-700 px-3 py-2">
        <button
          type="button"
          class="text-[11px] font-semibold text-red-300 hover:text-red-200"
          @click="clearAll"
        >
          Clear progress &amp; restart onboarding
        </button>
      </div>
    </div>

    <!-- Toggle. Deliberately drab: it must never be mistaken for app chrome. -->
    <button
      type="button"
      class="flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-2 text-[11px] font-semibold text-slate-100 shadow-lg ring-1 ring-slate-700"
      @click="open = !open"
    >
      <span aria-hidden="true">🧪</span>
      <span>{{ progress.nickname || 'no user' }}</span>
      <span class="font-mono text-slate-400">
        {{ progress.earnedCount }}/{{ missionsStore.badgeTarget }}
      </span>
    </button>
  </div>
</template>
