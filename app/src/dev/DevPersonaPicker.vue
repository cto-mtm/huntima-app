<script setup lang="ts">
/**
 * Dev-only sign-in shortcuts, rendered inline on the entry screen.
 *
 * This replaced a floating overlay pill. The pill was discoverable only if
 * you already knew it was there — "how do I switch users" has to be
 * answerable by looking at the screen where you choose who to be.
 *
 * Covers BOTH audiences, because both are tedious to reach by hand: a fan at
 * a given progress state (five captures to see the prize screen), and staff
 * (seed the account, then log in with credentials you have to remember).
 *
 * Eliminated from production: EntryPage resolves this through a dynamic
 * import inside an `import.meta.env.DEV` branch. See CLAUDE.md § Dev tooling.
 */
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { DEV_PERSONAS, type DevPersona } from './personas'
import { useMissionsStore } from '../stores/missions'
import { useProgressStore } from '../stores/progress'
import { useSessionStore } from '../stores/session'
import { apiPost } from '../lib/api'

const router = useRouter()
const progress = useProgressStore()
const missionsStore = useMissionsStore()
const session = useSessionStore()

/**
 * Which persona (if any) the current session matches. Without this the entry
 * screen says "Continue as MidInning" with nothing on screen explaining where
 * that name came from.
 */
const activePersonaId = computed(() => {
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

function applyFan(persona: DevPersona): void {
  const wanted = persona.badgeCount(missionsStore.badgeTarget)

  // Real mission ids, so the trophy case renders actual badges.
  progress.nickname = persona.nickname
  // Personas do not pick an avatar: avatars are staff-uploaded images and a
  // dev fixture cannot know which ones exist. The monogram fallback applies.
  progress.avatarId = null
  progress.earnedIds = missionsStore.missions.slice(0, wanted).map((m) => m.id)
  progress.redeemed = persona.redeemed ?? false

  session.continueAsGuest()
  void router.push({ name: 'home' })
}

// ── Staff shortcut ──────────────────────────────────────────────────
interface SeedResponse {
  email: string
  password: string
}

const staffState = ref<'idle' | 'working' | 'failed'>('idle')
const staffError = ref<string | null>(null)

/**
 * Signing in is not the same as being an admin: the role is granted by the
 * auth listener once it has read the verified `admin` claim. Wait for that
 * rather than navigating straight after signInAsAdmin resolves, or the
 * route guard runs before the claim has landed and bounces us to login.
 */
function waitForAdmin(timeoutMs = 6000): Promise<boolean> {
  if (session.isAdmin) return Promise.resolve(true)

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      stop()
      resolve(false)
    }, timeoutMs)

    const stop = watch(
      () => session.isAdmin,
      (granted) => {
        if (!granted) return
        clearTimeout(timer)
        stop()
        resolve(true)
      },
    )
  })
}

async function signInAsStaff(): Promise<void> {
  staffState.value = 'working'
  staffError.value = null

  // The Auth emulator starts empty and custom claims cannot be set from the
  // client SDK, so the account has to be seeded server-side first. Idempotent.
  const seeded = await apiPost<SeedResponse>('/dev/seed-admin', {})
  if (!seeded.ok) {
    staffState.value = 'failed'
    staffError.value = 'Emulator unreachable. Is `npm run emulators` running?'
    return
  }

  // Attach the auth listener BEFORE signing in, so the claim is observed.
  await session.ensureAuthReady()

  const ok = await session.signInWithEmail(seeded.data.email, seeded.data.password)
  if (!ok || !(await waitForAdmin())) {
    staffState.value = 'failed'
    staffError.value = 'Signed in, but the admin claim never arrived.'
    return
  }

  staffState.value = 'idle'
  void router.push({ name: 'admin-branding' })
}
</script>

<template>
  <div class="rounded-xl border border-slate-700 bg-slate-900 p-3 text-slate-100">
    <p class="text-[11px] font-bold uppercase tracking-wide">🧪 Dev shortcuts</p>
    <p class="mt-0.5 text-[10px] text-slate-400">Emulator only. Skip straight to a session.</p>

    <!-- Fans -->
    <p class="mt-2.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">Fan</p>
    <ul class="mt-1 space-y-1">
      <li v-for="persona in DEV_PERSONAS" :key="persona.id">
        <button
          type="button"
          class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-800"
          @click="applyFan(persona)"
        >
          <span aria-hidden="true" class="text-sm leading-none">{{ persona.emoji }}</span>
          <span class="flex-1 text-[11px] font-semibold">
            {{ persona.label }}
            <span
              v-if="activePersonaId === persona.id"
              class="ml-1 rounded-full bg-green-500/20 px-1.5 text-[9px] font-bold uppercase text-green-300"
            >
              active
            </span>
          </span>
          <span class="font-mono text-[10px] text-slate-400">
            {{ persona.badgeCount(missionsStore.badgeTarget) }}/{{ missionsStore.badgeTarget }}
          </span>
        </button>
      </li>
    </ul>

    <!-- Staff -->
    <p class="mt-3 text-[9px] font-bold uppercase tracking-wider text-slate-500">Staff</p>
    <button
      type="button"
      class="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-800 disabled:opacity-60"
      :disabled="staffState === 'working'"
      @click="signInAsStaff"
    >
      <span aria-hidden="true" class="text-sm leading-none">🛠️</span>
      <span class="flex-1 text-[11px] font-semibold">
        {{ staffState === 'working' ? 'Signing in…' : 'Admin dashboard' }}
      </span>
      <span class="font-mono text-[10px] text-slate-400">admin@demo.local</span>
    </button>

    <p v-if="staffError" class="mt-1.5 px-2 text-[10px] font-semibold text-red-300">
      {{ staffError }}
    </p>
    <p v-else class="mt-1.5 px-2 text-[10px] text-slate-500">
      Seeds the account, signs in, opens Branding.
    </p>
  </div>
</template>
