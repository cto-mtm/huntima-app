<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '../components/BaseButton.vue'
import { useApi } from '../composables/useApi'
import { API_BASE_URL } from '../lib/api'

interface HealthResponse {
  ok: boolean
  ts: string
}

const { t, d } = useI18n()

const buildMode = import.meta.env.MODE

// Proves the full app -> Cloud Function path on a fresh clone. If this
// renders green against the emulator, the local setup is correct.
const { data, error, loading, execute } = useApi<HealthResponse>('/health')

onMounted(() => {
  void execute()
})
</script>

<template>
  <!-- The custom per-page transition from docs/animations.md § 2 lives on
       this element. The name is static, which is only safe because a page
       root renders exactly once. See Recipe 6 in transitions.css. -->
  <section class="py-6" style="view-transition-name: about-page">
    <h1 class="text-2xl font-extrabold text-brand-900">{{ t('about.title') }}</h1>
    <p class="mt-2 text-sm text-muted">{{ t('about.body') }}</p>

    <div class="mt-6 rounded-card bg-surface p-4 shadow-sm ring-1 ring-brand-100">
      <h2 class="text-sm font-bold text-brand-900">{{ t('about.healthTitle') }}</h2>
      <p class="mt-1 text-xs text-muted">{{ t('about.healthNote') }}</p>

      <p v-if="loading" class="mt-3 text-sm text-muted">{{ t('common.loading') }}</p>

      <p v-else-if="data" class="mt-3 text-sm font-semibold text-green-700">
        {{ t('about.healthOk', { ts: d(new Date(data.ts), 'time') }) }}
      </p>

      <p v-else class="mt-3 text-sm font-semibold text-red-600">
        {{ t('about.healthFail', { reason: error ?? t('common.error') }) }}
      </p>

      <!-- Worth showing: the two things you need to know when someone says
           "it doesn't work" from the concourse. -->
      <p class="mt-3 break-all font-mono text-[11px] text-muted">{{ API_BASE_URL }}</p>
      <p class="font-mono text-[11px] text-muted">{{ t('about.versionLabel') }}: {{ buildMode }}</p>

      <div class="mt-4">
        <BaseButton variant="secondary" :disabled="loading" @click="execute">
          {{ t('about.check') }}
        </BaseButton>
      </div>
    </div>

    <div class="mt-4 flex flex-col items-center gap-3">
      <RouterLink :to="{ name: 'entry' }" class="text-sm font-semibold text-brand-600">
        {{ t('entry.switchUser') }}
      </RouterLink>
      <RouterLink :to="{ name: 'staff-login' }" class="text-xs font-semibold text-muted">
        {{ t('entry.staffSignIn') }}
      </RouterLink>
    </div>
  </section>
</template>
