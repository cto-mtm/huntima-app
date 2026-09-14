<script setup lang="ts">
/**
 * The org's public address, as a link and as a QR code.
 *
 * Every fan-facing string in this product says "scan the QR code", and until
 * now nothing in the console ever showed an organizer their own URL or gave
 * them a code to print. Claiming a web address ended with them having to guess
 * what it was.
 *
 * It sits at the top of the hunt list because that is the screen staff live
 * on, and because the link is what turns a built hunt into a played one.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { fanPageUrl } from '../../lib/publicUrl'
import { qrSvg } from '../../lib/qr'
import { useTenantStore } from '../../stores/tenant'

const { t } = useI18n()
const tenant = useTenantStore()

/** The router guard guarantees an active slug on every admin route. */
const url = computed(() => fanPageUrl(tenant.slug ?? ''))

const svg = ref<string | null>(null)
const copied = ref(false)

async function render(): Promise<void> {
  svg.value = await qrSvg(url.value)
}

onMounted(render)
// Switching orgs in the same tab must not leave the previous club's code up.
watch(url, () => {
  svg.value = null
  void render()
})

async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(url.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    // Clipboard denied (an insecure origin, or a browser prompt refused). The
    // address is on screen and selectable, so there is nothing to recover.
  }
}

/**
 * Hands over the SVG itself rather than a screenshot of it: this code gets
 * printed on posters and table cards, and a raster QR enlarged to A3 is a QR
 * that stops scanning.
 */
function download(): void {
  if (!svg.value) return
  const blob = new Blob([svg.value], { type: 'image/svg+xml' })
  const href = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = href
  link.download = `${tenant.slug}-qr.svg`
  link.click()
  URL.revokeObjectURL(href)
}
</script>

<template>
  <div class="rounded-card bg-surface p-4 shadow-sm ring-1 ring-brand-100">
    <h2 class="text-sm font-bold uppercase tracking-wide text-brand-900">
      {{ t('hunts.shareHeading') }}
    </h2>
    <p class="mt-0.5 text-xs text-muted">{{ t('hunts.shareHelp') }}</p>

    <div class="mt-3 flex flex-wrap items-start gap-4">
      <!-- Black on white, deliberately unthemed: a QR in club colors is a QR
           that will not scan off a printed poster. See lib/qr.ts. -->
      <!-- eslint-disable-next-line vue/no-v-html -- generated geometry only, no caller text -->
      <div
        v-if="svg"
        class="size-32 shrink-0 rounded-xl bg-white p-1 ring-1 ring-brand-100 [&>svg]:size-full"
        v-html="svg"
      />
      <div
        v-else
        class="size-32 shrink-0 animate-pulse rounded-xl bg-brand-50 ring-1 ring-brand-100"
        aria-hidden="true"
      />

      <div class="min-w-0 flex-1">
        <p class="break-all font-mono text-xs text-brand-900" translate="no">{{ url }}</p>

        <div class="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700"
            @click="copy"
          >
            {{ copied ? t('hunts.linkCopied') : t('hunts.copyLink') }}
          </button>
          <button
            type="button"
            class="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 disabled:opacity-60"
            :disabled="!svg"
            @click="download"
          >
            {{ t('hunts.downloadQr') }}
          </button>
          <RouterLink
            :to="{ name: 'home', params: { tenantSlug: tenant.slug } }"
            class="text-xs font-semibold text-brand-600"
          >
            {{ t('hunts.viewFanPage') }}
          </RouterLink>
        </div>
      </div>
    </div>
  </div>
</template>
