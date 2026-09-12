<script setup lang="ts">
/**
 * Staff-only API health check. It used to live on the fan-facing About screen,
 * but a green "API reachable at 19:04" line is a diagnostic for whoever runs
 * the event, not something a family needs mid-game — so it belongs here.
 */
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseButton from '../BaseButton.vue'
import { useApi } from '../../composables/useApi'
import { API_BASE_URL } from '../../lib/api'

interface HealthResponse {
  ok: boolean
  ts: string
  /** Added server-side: whether real vision verification is configured. */
  verificationLive?: boolean
  /** The pinned model id, for a quick "still valid?" check. */
  model?: string
}

const { t, d } = useI18n()
const buildMode = import.meta.env.MODE

const { data, error, loading, execute } = useApi<HealthResponse>('/health')

onMounted(() => {
  void execute()
})
</script>

<template>
  <div class="rounded-card bg-surface p-4 shadow-sm ring-1 ring-brand-100">
    <h2 class="text-sm font-bold uppercase tracking-wide text-brand-900">
      {{ t('admin.diagHeading') }}
    </h2>
    <p class="mt-1 text-xs text-muted">{{ t('admin.diagNote') }}</p>

    <p v-if="loading" class="mt-3 text-sm text-muted">{{ t('common.loading') }}</p>
    <p v-else-if="data" class="mt-3 text-sm font-semibold text-green-700">
      {{ t('admin.diagOk', { ts: d(new Date(data.ts), 'time') }) }}
    </p>
    <p v-else class="mt-3 text-sm font-semibold text-red-600">
      {{ t('admin.diagFail', { reason: error ?? t('common.error') }) }}
    </p>

    <!-- Verification status: a STUB (auto-pass) backend is expected locally
         but a silent honor-system in production, so call it out loudly. -->
    <p
      v-if="data && data.verificationLive"
      class="mt-2 text-xs font-semibold text-green-700"
    >
      {{ t('admin.diagVerifyLive', { model: data.model ?? '?' }) }}
    </p>
    <p
      v-else-if="data"
      class="mt-2 rounded-lg bg-accent-500/10 px-2.5 py-1.5 text-xs font-semibold text-accent-600"
    >
      {{ t('admin.diagVerifyStub') }}
    </p>

    <p class="mt-3 break-all font-mono text-[11px] text-muted">{{ API_BASE_URL }}</p>
    <p class="font-mono text-[11px] text-muted">{{ t('admin.diagBuildLabel') }}: {{ buildMode }}</p>

    <div class="mt-4">
      <BaseButton variant="secondary" :disabled="loading" @click="execute">
        {{ t('admin.diagCheck') }}
      </BaseButton>
    </div>
  </div>
</template>
