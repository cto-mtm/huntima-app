import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { tenantConfigSchema, type TenantConfig } from 'shared'
import { ACCENT_STOPS, BRAND_STOPS, generateRamp, isValidHex, normalizeHex } from '../lib/color'
import { DEFAULT_TENANT } from '../config/tenant'
import { apiFetch } from '../lib/api'
import { useSessionStore } from './session'

const CACHE_KEY = 'photo-hunt:tenant'

/**
 * The live club identity.
 *
 * The API is the source of truth — branding decides what an entire stadium
 * sees, so it cannot be per-device. localStorage is a CACHE, not the truth:
 * it exists so the first paint is already branded before the network answers,
 * and so the app still looks like the club with no signal at all.
 *
 * How the re-skin works: Tailwind v4 compiles `bg-brand-600` down to
 * `background-color: var(--color-brand-600)`, so writing that custom property
 * onto <html> re-skins every utility with no rebuild and no reload. There is
 * no theme framework underneath this.
 */
function readCache(): TenantConfig {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return { ...DEFAULT_TENANT }
    const parsed = tenantConfigSchema.safeParse(JSON.parse(raw))
    // A cache written by an older build is discarded rather than merged: a
    // half-shaped brand renders as broken images and wrong colors.
    return parsed.success ? parsed.data : { ...DEFAULT_TENANT }
  } catch {
    return { ...DEFAULT_TENANT }
  }
}

function writeCache(config: TenantConfig): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(config))
  } catch {
    // Private browsing. The brand still applies for this session.
  }
}

export const useTenantStore = defineStore('tenant', () => {
  const session = useSessionStore()

  const settings = ref<TenantConfig>(readCache())
  /** The last state known to be on the server, for dirty tracking. */
  const published = ref<TenantConfig>({ ...settings.value })

  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  const dirty = computed(() => JSON.stringify(settings.value) !== JSON.stringify(published.value))

  const brandRamp = computed(() =>
    generateRamp(
      isValidHex(settings.value.brandBase) ? settings.value.brandBase : DEFAULT_TENANT.brandBase,
      BRAND_STOPS,
    ),
  )

  const accentRamp = computed(() =>
    generateRamp(
      isValidHex(settings.value.accentBase) ? settings.value.accentBase : DEFAULT_TENANT.accentBase,
      ACCENT_STOPS,
    ),
  )

  const isDefault = computed(
    () => JSON.stringify(settings.value) === JSON.stringify(DEFAULT_TENANT),
  )

  function applyTheme(): void {
    const root = document.documentElement
    for (const [stop, hex] of Object.entries(brandRamp.value)) {
      root.style.setProperty(`--color-brand-${stop}`, hex)
    }
    for (const [stop, hex] of Object.entries(accentRamp.value)) {
      root.style.setProperty(`--color-accent-${stop}`, hex)
    }
  }

  /** Public read. Every session calls this once on boot. */
  async function load(): Promise<void> {
    loading.value = true
    const result = await apiFetch<unknown>('/tenant')

    if (result.ok) {
      const parsed = tenantConfigSchema.safeParse(result.data)
      if (parsed.success) {
        settings.value = parsed.data
        published.value = { ...parsed.data }
        writeCache(parsed.data)
      } else {
        // Server reachable but shape wrong — a deploy skew. Keep the cached
        // brand rather than flashing the default palette at a stadium.
        console.error('[tenant] unexpected /tenant payload', parsed.error.issues)
      }
    }

    loading.value = false
  }

  /** Staff write. Publishes the brand to every device in the building. */
  async function save(): Promise<boolean> {
    saving.value = true
    error.value = null

    const token = await session.getIdToken()
    if (!token) {
      error.value = 'Not signed in'
      saving.value = false
      return false
    }

    const result = await apiFetch<unknown>('/admin/tenant', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(settings.value),
    })

    saving.value = false

    if (!result.ok) {
      error.value = result.error
      return false
    }

    published.value = { ...settings.value }
    writeCache(settings.value)
    return true
  }

  function setBrandBase(hex: string): void {
    if (isValidHex(hex)) settings.value.brandBase = normalizeHex(hex)
  }

  function setAccentBase(hex: string): void {
    if (isValidHex(hex)) settings.value.accentBase = normalizeHex(hex)
  }

  /** Local revert to defaults. Nothing is published until save(). */
  function reset(): void {
    settings.value = { ...DEFAULT_TENANT, avatars: [] }
  }

  // Apply immediately so the first paint is already branded — a flash of the
  // default palette on every load is exactly what a white-label product
  // cannot afford.
  applyTheme()

  watch(settings, applyTheme, { deep: true })

  return {
    settings,
    published,
    loading,
    saving,
    error,
    dirty,
    brandRamp,
    accentRamp,
    isDefault,
    applyTheme,
    load,
    save,
    setBrandBase,
    setAccentBase,
    reset,
  }
})
