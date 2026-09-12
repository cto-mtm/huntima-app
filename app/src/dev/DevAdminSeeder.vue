<script setup lang="ts">
/**
 * Dev-only: creates the demo staff account in the Auth emulator.
 *
 * Needed because the Auth emulator starts empty and custom claims cannot be
 * set from the client SDK by design — so a fresh clone has no way into the
 * admin dashboard without this. The endpoint it calls is itself gated on
 * FUNCTIONS_EMULATOR server-side; this button is only the convenience.
 *
 * Eliminated from production builds. See CLAUDE.md § Dev tooling.
 */
import { ref } from 'vue'
import { apiPost } from '../lib/api'

const emit = defineEmits<{ filled: [creds: { email: string; password: string }] }>()

interface SeedResponse {
  uid: string
  email: string
  password: string
  isAdmin: boolean
}

const state = ref<'idle' | 'working' | 'done' | 'failed'>('idle')

async function seed(): Promise<void> {
  state.value = 'working'
  const result = await apiPost<SeedResponse>('/dev/seed-admin', {})

  if (result.ok) {
    state.value = 'done'
    emit('filled', { email: result.data.email, password: result.data.password })
  } else {
    state.value = 'failed'
  }
}
</script>

<template>
  <div class="rounded-xl border border-slate-700 bg-slate-900 p-3 text-slate-100">
    <p class="text-[11px] font-bold uppercase tracking-wide">🧪 Dev shortcut</p>
    <p class="mt-0.5 text-[10px] text-slate-400">
      The Auth emulator starts empty. This creates a staff account with the
      <code>admin</code> claim and fills the form.
    </p>

    <button
      type="button"
      class="mt-2 w-full rounded-lg bg-slate-100 px-3 py-2 text-[11px] font-bold text-slate-900 disabled:opacity-60"
      :disabled="state === 'working'"
      @click="seed"
    >
      {{ state === 'working' ? 'Creating…' : 'Create demo admin' }}
    </button>

    <p v-if="state === 'done'" class="mt-2 text-[10px] font-semibold text-green-300">
      Ready — credentials filled in above.
    </p>
    <p v-else-if="state === 'failed'" class="mt-2 text-[10px] font-semibold text-red-300">
      Could not reach the emulator. Is <code>npm run emulators</code> running?
    </p>
  </div>
</template>
