import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { ACCENT_STOPS, BRAND_STOPS, generateRamp, isValidHex, normalizeHex } from '../lib/color'
import { DEFAULT_TENANT, type TenantAvatar, type TenantConfig } from '../config/tenant'

const STORAGE_KEY = 'photo-hunt:tenant'

/**
 * Values that were once shipped as defaults. A browser still holding one of
 * these never chose it, so it is migrated rather than preserved — otherwise
 * changing a placeholder only affects people who have never opened the app.
 */
const LEGACY_DEFAULT_TEAM_NAMES = ['REPLACE_ME Team']

function load(): TenantConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_TENANT }
    const parsed = JSON.parse(raw) as Partial<TenantConfig>

    if (parsed.teamName && LEGACY_DEFAULT_TEAM_NAMES.includes(parsed.teamName)) {
      parsed.teamName = DEFAULT_TENANT.teamName
    }
    // Merge rather than replace: a config saved by an older build is missing
    // any field added since, and a half-populated theme is worse than none.
    return {
      ...DEFAULT_TENANT,
      ...parsed,
      geofence: { ...DEFAULT_TENANT.geofence, ...(parsed.geofence ?? {}) },
      // Avatars used to be emoji strings. Anything that is not the current
      // { id, url, label } shape is dropped rather than migrated — there is
      // no image to migrate an emoji into, and a half-shaped entry would
      // render as a broken img.
      avatars: Array.isArray(parsed.avatars)
        ? (parsed.avatars.filter(
            (a): a is TenantAvatar =>
              typeof a === 'object' && a !== null && typeof (a as TenantAvatar).url === 'string',
          ) as TenantAvatar[])
        : [],
    }
  } catch {
    return { ...DEFAULT_TENANT }
  }
}

/**
 * The live tenant identity, and the white-label seam.
 *
 * How the re-skin actually works: Tailwind v4's @theme block in main.css
 * compiles `bg-brand-600` down to `background-color: var(--color-brand-600)`.
 * So overriding that custom property on <html> at runtime re-skins every
 * utility in the app with no rebuild and no page reload. That is the whole
 * mechanism — there is no theme framework underneath this.
 *
 * SEAM: persistence is localStorage, i.e. per-device. A real deployment
 * serves the tenant config from the API alongside the campaign so every fan
 * in the building sees the same brand. Swap `load()`/`persist()` for that
 * fetch; nothing else in the app changes.
 */
export const useTenantStore = defineStore('tenant', () => {
  const settings = ref<TenantConfig>(load())

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
    () =>
      settings.value.brandBase === DEFAULT_TENANT.brandBase &&
      settings.value.accentBase === DEFAULT_TENANT.accentBase &&
      settings.value.teamName === DEFAULT_TENANT.teamName,
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

  function persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings.value))
    } catch {
      // Private browsing. The theme still applies for this session.
    }
  }

  function setBrandBase(hex: string): void {
    if (!isValidHex(hex)) return
    settings.value.brandBase = normalizeHex(hex)
  }

  function setAccentBase(hex: string): void {
    if (!isValidHex(hex)) return
    settings.value.accentBase = normalizeHex(hex)
  }

  function reset(): void {
    settings.value = { ...DEFAULT_TENANT, avatars: [] }
  }

  // Apply immediately so the first paint is already branded — a flash of the
  // default palette on every load is exactly what a white-label product
  // cannot afford.
  applyTheme()

  // Write once at startup so a migrated legacy value is actually replaced in
  // storage. Without this the migration re-runs on every load and the stale
  // value resurfaces the day LEGACY_DEFAULT_TEAM_NAMES is pruned.
  persist()

  watch(
    settings,
    () => {
      applyTheme()
      persist()
    },
    { deep: true },
  )

  return {
    settings,
    brandRamp,
    accentRamp,
    isDefault,
    applyTheme,
    setBrandBase,
    setAccentBase,
    reset,
  }
})
