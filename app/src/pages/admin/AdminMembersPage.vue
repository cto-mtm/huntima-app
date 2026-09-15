<script setup lang="ts">
/**
 * The org's team: who can open this console.
 *
 * `POST /t/:slug/admin/members` shipped with Phase 1 — an org's second staff
 * account needed a door — but nothing in the app ever called it, so the roles
 * the API enforces were invisible and a venue's second account had no way in.
 *
 * Adding someone needs an existing Huntima account with that email. There is
 * no invitation email and no pending state, which is a deliberate limit rather
 * than an oversight: see stores/members.ts.
 */
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { OrgRole } from 'shared'
import BaseButton from '../../components/BaseButton.vue'
import LoadingLine from '../../components/LoadingLine.vue'
import { useMembersStore } from '../../stores/members'
import { useOrgsStore } from '../../stores/orgs'
import { useSessionStore } from '../../stores/session'
import { useTenantStore } from '../../stores/tenant'

const { t } = useI18n()
const members = useMembersStore()
const orgs = useOrgsStore()
const session = useSessionStore()
const tenant = useTenantStore()

const email = ref('')
const role = ref<OrgRole>('editor')
const addError = ref<'no-account' | 'forbidden' | 'last-owner' | 'error' | null>(null)
const removeError = ref<'last-owner' | 'forbidden' | 'error' | null>(null)

/**
 * The caller's own role in this org, from the list the picker already loaded.
 * Only a gate on what to DRAW — the API refuses an editor's write regardless.
 */
const myRole = computed(() =>
  session.isAdmin
    ? 'operator'
    : (orgs.orgs.find((o) => o.slug === tenant.slug)?.role ?? null),
)
const canManage = computed(() => myRole.value === 'owner' || myRole.value === 'operator')

onMounted(async () => {
  if (!session.isAdmin) await orgs.ensureLoaded()
  await members.load()
})

async function add(): Promise<void> {
  addError.value = null
  const address = email.value.trim()
  if (!address) return

  const result = await members.add(address, role.value)
  if (result.ok) {
    email.value = ''
    return
  }
  addError.value = result.reason
}

async function remove(uid: string, label: string): Promise<void> {
  removeError.value = null
  if (!window.confirm(t('team.removeConfirm', { who: label }))) return

  const result = await members.remove(uid)
  if (!result.ok) removeError.value = result.reason
}
</script>

<template>
  <section class="py-5">
    <header class="mt-5">
      <h1 class="text-2xl font-extrabold text-brand-900">{{ t('team.title') }}</h1>
      <p class="mt-1 text-sm text-muted">{{ t('team.subtitle') }}</p>
    </header>

    <p
      v-if="members.error"
      class="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
    >
      {{ t('team.loadFailed') }}
    </p>

    <LoadingLine v-if="members.loading" class="mt-6" />

    <ul v-else class="mt-6 grid gap-2.5">
      <li
        v-for="member in members.members"
        :key="member.uid"
        class="flex flex-wrap items-center gap-2 rounded-card bg-surface p-3.5 shadow-sm ring-1 ring-brand-100"
      >
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-semibold text-brand-900" translate="no">
            {{ member.email ?? t('team.noEmail') }}
            <span v-if="member.uid === session.user?.uid" class="font-normal text-muted">
              {{ t('team.you') }}
            </span>
          </p>
        </div>
        <span
          class="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold uppercase text-brand-600"
        >
          {{ t(`orgs.role.${member.role}`) }}
        </span>
        <!-- Never your own row: removing your own seat locks you out of the
             console you are standing in. Leaving an org is a deliberate
             action, not a button next to everyone else's. -->
        <button
          v-if="canManage && member.uid !== session.user?.uid"
          type="button"
          class="shrink-0 text-xs font-semibold text-red-600 disabled:opacity-60"
          :disabled="members.saving"
          @click="remove(member.uid, member.email ?? member.uid)"
        >
          {{ t('team.remove') }}
        </button>
      </li>
    </ul>

    <p v-if="removeError" class="mt-2 text-xs font-medium text-red-600">
      {{
        removeError === 'last-owner'
          ? t('team.removeLastOwner')
          : removeError === 'forbidden'
            ? t('team.ownerOnly')
            : t('team.removeFailed')
      }}
    </p>

    <!-- ── Add ─────────────────────────────────────────────────── -->
    <form
      v-if="canManage"
      class="mt-6 rounded-card bg-surface p-4 shadow-sm ring-1 ring-brand-100"
      @submit.prevent="add"
    >
      <h2 class="text-sm font-bold uppercase tracking-wide text-brand-900">
        {{ t('team.addHeading') }}
      </h2>
      <p class="mt-0.5 text-xs text-muted">{{ t('team.addHelp') }}</p>

      <div class="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
        <div>
          <label for="member-email" class="block text-xs font-semibold text-brand-900">
            {{ t('team.emailLabel') }}
          </label>
          <input
            id="member-email"
            v-model="email"
            type="email"
            required
            autocomplete="off"
            class="mt-1 w-full rounded-xl border border-brand-200 bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500"
          />
        </div>

        <div>
          <label for="member-role" class="block text-xs font-semibold text-brand-900">
            {{ t('team.roleLabel') }}
          </label>
          <select
            id="member-role"
            v-model="role"
            class="mt-1 w-full rounded-xl border border-brand-200 bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500"
          >
            <option value="editor">{{ t('orgs.role.editor') }}</option>
            <option value="owner">{{ t('orgs.role.owner') }}</option>
          </select>
        </div>
      </div>

      <p class="mt-2 text-xs text-muted">{{ t('team.roleHelp') }}</p>

      <div class="mt-3">
        <BaseButton type="submit" :disabled="members.saving || !email.trim()">
          {{ members.saving ? t('team.adding') : t('team.add') }}
        </BaseButton>
      </div>

      <p v-if="addError" class="mt-2 text-xs font-medium text-red-600">
        {{
          addError === 'no-account'
            ? t('team.addNoAccount')
            : addError === 'forbidden'
              ? t('team.ownerOnly')
              : addError === 'last-owner'
                ? t('team.removeLastOwner')
                : t('team.addFailed')
        }}
      </p>
    </form>

    <p v-else class="mt-6 text-xs text-muted">{{ t('team.ownerOnlyNotice') }}</p>
  </section>
</template>
