<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AdminNav from '../../components/admin/AdminNav.vue'
import BaseButton from '../../components/BaseButton.vue'
import { useHuntsStore } from '../../stores/hunts'
import { useTenantStore } from '../../stores/tenant'

const { t } = useI18n()
const router = useRouter()
const hunts = useHuntsStore()
const tenant = useTenantStore()

const name = ref('')
const badgeTarget = ref(tenant.settings.badgeTarget)

onMounted(() => {
  void hunts.loadAll()
})

async function createHunt(): Promise<void> {
  if (!name.value.trim()) return

  const created = await hunts.create({
    name: name.value.trim(),
    badgeTarget: badgeTarget.value,
    // Always a draft. Creating a hunt must never change what a stadium full
    // of people is currently looking at.
    status: 'draft',
  })

  if (created) {
    name.value = ''
    void router.push({ name: 'admin-hunt-edit', params: { id: created.id } })
  }
}

async function togglePublish(id: string, status: 'draft' | 'published'): Promise<void> {
  await hunts.patch(id, { status: status === 'published' ? 'draft' : 'published' })
  await hunts.loadAll()
}

async function remove(id: string): Promise<void> {
  if (window.confirm(t('hunts.deleteConfirm'))) await hunts.remove(id)
}
</script>

<template>
  <section class="py-5">
    <AdminNav />

    <header class="mt-5">
      <h1 class="text-2xl font-extrabold text-brand-900">{{ t('hunts.title') }}</h1>
      <p class="mt-1 text-sm text-muted">{{ t('hunts.subtitle') }}</p>
    </header>

    <p v-if="hunts.error" class="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
      {{ t('hunts.loadFailed') }}
    </p>

    <!-- ── Create ──────────────────────────────────────────────── -->
    <form class="mt-6 rounded-card bg-surface p-4 shadow-sm ring-1 ring-brand-100" @submit.prevent="createHunt">
      <h2 class="text-sm font-bold uppercase tracking-wide text-brand-900">
        {{ t('hunts.newHuntHeading') }}
      </h2>

      <div class="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
        <div>
          <label for="hunt-name" class="block text-xs font-semibold text-brand-900">
            {{ t('hunts.nameLabel') }}
          </label>
          <input
            id="hunt-name"
            v-model="name"
            type="text"
            required
            :placeholder="t('hunts.namePlaceholder')"
            class="mt-1 w-full rounded-xl border border-brand-200 bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500"
          />
        </div>

        <div>
          <label for="hunt-target" class="block text-xs font-semibold text-brand-900">
            {{ t('hunts.badgeTargetLabel') }}
          </label>
          <input
            id="hunt-target"
            v-model.number="badgeTarget"
            type="number"
            min="1"
            max="50"
            class="mt-1 w-24 rounded-xl border border-brand-200 bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500"
          />
        </div>
      </div>

      <div class="mt-3">
        <BaseButton type="submit" :disabled="hunts.saving || !name.trim()">
          {{ hunts.saving ? t('hunts.creating') : t('hunts.create') }}
        </BaseButton>
      </div>
    </form>

    <!-- ── List ────────────────────────────────────────────────── -->
    <p v-if="!hunts.loading && !hunts.campaigns.length" class="mt-6 text-sm text-muted">
      {{ t('hunts.empty') }}
    </p>

    <ul class="mt-6 grid gap-2.5">
      <li
        v-for="hunt in hunts.campaigns"
        :key="hunt.id"
        class="flex flex-wrap items-center gap-3 rounded-card bg-surface p-3.5 shadow-sm ring-1 ring-brand-100"
      >
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <h3 class="truncate font-semibold text-brand-900">{{ hunt.name }}</h3>
            <span
              class="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase"
              :class="
                hunt.status === 'published'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-brand-50 text-brand-600'
              "
            >
              {{ t(`hunts.status.${hunt.status}`) }}
            </span>
          </div>
          <p class="mt-0.5 text-xs text-muted">
            {{ t('hunts.missionCount', { count: hunt.missions.length }) }} ·
            {{ hunt.badgeTarget }}
          </p>
        </div>

        <div class="flex shrink-0 items-center gap-2">
          <BaseButton
            variant="secondary"
            @click="router.push({ name: 'admin-hunt-edit', params: { id: hunt.id } })"
          >
            {{ t('hunts.edit') }}
          </BaseButton>
          <BaseButton variant="ghost" @click="togglePublish(hunt.id, hunt.status)">
            {{ hunt.status === 'published' ? t('hunts.unpublish') : t('hunts.publish') }}
          </BaseButton>
          <button
            type="button"
            class="text-xs font-semibold text-red-600"
            @click="remove(hunt.id)"
          >
            {{ t('hunts.deleteHunt') }}
          </button>
        </div>
      </li>
    </ul>

    <p class="mt-4 text-xs text-muted">{{ t('hunts.publishedWarning') }}</p>
  </section>
</template>
