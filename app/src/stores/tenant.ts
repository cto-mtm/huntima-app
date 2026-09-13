import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { tenantConfigSchema, type TenantConfig } from 'shared'
import { ACCENT_STOPS, BRAND_STOPS, generateRamp, isValidHex, normalizeHex } from '../lib/color'
import { DEFAULT_TENANT } from '../config/tenant'
import { applyFont } from '../lib/fonts'
import { apiFetch } from '../lib/api'
import { useSessionStore } from './session'

/** Per-org cache key: one browser can hold several clubs' brands at once. */
function cacheKey(slug: string): string {
  return `huntima:tenant:${slug}`
}

/**
 * The live org identity, keyed by the URL slug.
 *
 * The API is the source of truth — branding decides what an entire stadium
 * sees, so it cannot be per-device. localStorage is a CACHE, not the truth:
 * it exists so the first paint is already branded before the network answers,
 * and so the app still looks like the club with no signal at all.
 *
 * Theme lifecycle: the router guard calls `activate(slug)` on entering any
 * tenant-scoped route (cached brand applies synchronously, then `load()`
 * reconciles) and `deactivate()` on leaving tenant scope, so platform pages
 * (landing, org picker) never wear the last-visited club's colors.
 *
 * How the re-skin works: Tailwind v4 compiles `bg-brand-600` down to
 * `background-color: var(--color-brand-600)`, so writing that custom property
 * onto <html> re-skins every utility with no rebuild and no reload. There is
 * no theme framework underneath this.
 */
function readCache(slug: string): TenantConfig {
  try {
    const raw = localStorage.getItem(cacheKey(slug))
    if (!raw) return { ...DEFAULT_TENANT }
    const parsed = tenantConfigSchema.safeParse(JSON.parse(raw))
    // A cache written by an older build is discarded rather than merged: a
    // half-shaped brand renders as broken images and wrong colors.
    return parsed.success ? parsed.data : { ...DEFAULT_TENANT }
  } catch {
    return { ...DEFAULT_TENANT }
  }
}

function writeCache(slug: string, config: TenantConfig): void {
  try {
    localStorage.setItem(cacheKey(slug), JSON.stringify(config))
  } catch {
    // Private browsing. The brand still applies for this session.
  }
}

export const useTenantStore = defineStore('tenant', () => {
  const session = useSessionStore()

  /** The org this browser tab is currently scoped to. Null on platform pages. */
  const slug = ref<string | null>(null)
  const settings = ref<TenantConfig>({ ...DEFAULT_TENANT })
  /** The last state known to be on the server, for dirty tracking. */
  const published = ref<TenantConfig>({ ...settings.value })

  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)
  /** True when the server said this slug does not exist — drives the
   *  "no team here" screen instead of a phantom default club. */
  const notFound = ref(false)

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

  function applyTheme(): void {
    applyFont(settings.value.fontFamily)

    const root = document.documentElement
    for (const [stop, hex] of Object.entries(brandRamp.value)) {
      root.style.setProperty(`--color-brand-${stop}`, hex)
    }
    for (const [stop, hex] of Object.entries(accentRamp.value)) {
      root.style.setProperty(`--color-accent-${stop}`, hex)
    }
  }

  /**
   * Scopes the store to an org. Synchronous on purpose: the cached brand is
   * painted before the guard resolves the navigation, so the page never
   * flashes the default palette — then `load()` reconciles from the API.
   * Idempotent per slug; the router calls this on every navigation.
   */
  function activate(nextSlug: string): void {
    if (slug.value === nextSlug) return
    slug.value = nextSlug
    notFound.value = false
    error.value = null
    settings.value = readCache(nextSlug)
    published.value = { ...settings.value }
    applyTheme()
    void load()
  }

  /** Leaves tenant scope: platform pages wear the platform default theme. */
  function deactivate(): void {
    if (slug.value === null) return
    slug.value = null
    notFound.value = false
    settings.value = { ...DEFAULT_TENANT }
    published.value = { ...settings.value }
    applyTheme()
  }

  /** Public read. Fired by `activate` whenever the slug changes. */
  async function load(): Promise<void> {
    const requested = slug.value
    if (!requested) return

    loading.value = true
    const result = await apiFetch<unknown>(`/t/${requested}/tenant`)

    // A rapid slug switch can land a stale response — discard it. Clear the
    // flag first: nothing else will, and a latched `loading` lies forever.
    if (slug.value !== requested) {
      loading.value = false
      return
    }

    if (result.ok) {
      const parsed = tenantConfigSchema.safeParse(result.data)
      if (parsed.success) {
        settings.value = parsed.data
        published.value = { ...parsed.data }
        writeCache(requested, parsed.data)
      } else {
        // Server reachable but shape wrong — a deploy skew. Keep the cached
        // brand rather than flashing the default palette at a stadium.
        console.error('[tenant] unexpected /tenant payload', parsed.error.issues)
      }
    } else if (result.status === 404) {
      // The org does not exist. Network failures deliberately do NOT set
      // this — a fan in a concrete concourse is offline, not at a dead URL.
      notFound.value = true
    }

    loading.value = false
  }

  /** Staff write. Publishes the brand to every device in the building. */
  async function save(): Promise<boolean> {
    if (!slug.value) return false
    saving.value = true
    error.value = null

    const token = await session.getIdToken()
    if (!token) {
      error.value = 'Not signed in'
      saving.value = false
      return false
    }

    const result = await apiFetch<unknown>(`/t/${slug.value}/admin/tenant`, {
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
    writeCache(slug.value, settings.value)
    return true
  }

  function setBrandBase(hex: string): void {
    if (isValidHex(hex)) settings.value.brandBase = normalizeHex(hex)
  }

  function setAccentBase(hex: string): void {
    if (isValidHex(hex)) settings.value.accentBase = normalizeHex(hex)
  }

  // Apply immediately so the first paint is already themed — a flash of the
  // wrong palette on every load is exactly what a white-label product
  // cannot afford. Before the router resolves this is the platform default;
  // `activate` swaps in the org's cached brand synchronously.
  applyTheme()

  watch(settings, applyTheme, { deep: true })

  return {
    slug,
    settings,
    published,
    loading,
    saving,
    error,
    notFound,
    dirty,
    brandRamp,
    accentRamp,
    applyTheme,
    activate,
    deactivate,
    load,
    save,
    setBrandBase,
    setAccentBase,
  }
})
