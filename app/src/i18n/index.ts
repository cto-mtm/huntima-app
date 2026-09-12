import { createI18n } from 'vue-i18n'

// ── Namespace modules ─────────────────────────────────────────────────
// Each module exports { en, es } and registers under its file name.
// Adding a namespace = one import + one line in each messages block.
import common from './locales/configs/common'
import missions from './locales/configs/missions'
import shell from './locales/components/shell'
import missionCard from './locales/components/missionCard'
import trophyCase from './locales/components/trophyCase'
import onboarding from './locales/pages/onboarding'
import hub from './locales/pages/hub'
import mission from './locales/pages/mission'
import capture from './locales/pages/capture'
import redeem from './locales/pages/redeem'
import about from './locales/pages/about'
import notFound from './locales/pages/notFound'
import admin from './locales/pages/admin'
import entry from './locales/pages/entry'

export const SUPPORTED_LOCALES = ['en', 'es'] as const
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

/** `en` is the authored source of truth; `es` is typed against it per module. */
export const DEFAULT_LOCALE: SupportedLocale = 'en'

const messages = {
  en: {
    common: common.en,
    missions: missions.en,
    shell: shell.en,
    missionCard: missionCard.en,
    trophyCase: trophyCase.en,
    onboarding: onboarding.en,
    hub: hub.en,
    mission: mission.en,
    capture: capture.en,
    redeem: redeem.en,
    about: about.en,
    notFound: notFound.en,
    admin: admin.en,
    entry: entry.en,
  },
  es: {
    common: common.es,
    missions: missions.es,
    shell: shell.es,
    missionCard: missionCard.es,
    trophyCase: trophyCase.es,
    onboarding: onboarding.es,
    hub: hub.es,
    mission: mission.es,
    capture: capture.es,
    redeem: redeem.es,
    about: about.es,
    notFound: notFound.es,
    admin: admin.es,
    entry: entry.es,
  },
}

/**
 * Type augmentation: gives `t()` key autocompletion across the app.
 *
 * Note the limit (documented in docs/i18n.md): vue-i18n keeps a permissive
 * `t(key: string)` overload, so an outright typo is NOT a tsc error. The
 * hard guarantee here is en↔es key parity, enforced per module by
 * `const es: typeof en`.
 */
export type AppMessageSchema = (typeof messages)['en']

declare module 'vue-i18n' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface DefineLocaleMessage extends AppMessageSchema {}
}

const datetimeFormats = {
  en: {
    short: { year: 'numeric', month: 'short', day: 'numeric' },
    time: { hour: 'numeric', minute: '2-digit' },
  },
  es: {
    short: { year: 'numeric', month: 'short', day: 'numeric' },
    time: { hour: 'numeric', minute: '2-digit' },
  },
} as const

const numberFormats = {
  en: { decimal: { style: 'decimal' } },
  es: { decimal: { style: 'decimal' } },
} as const

const STORAGE_KEY = 'photo-hunt:locale'

function isSupported(value: string | null): value is SupportedLocale {
  return value !== null && (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

/**
 * Stored choice wins; otherwise fall back to the device language.
 * Stadium crowds are mixed-language, so getting this right on first paint
 * matters more than usual.
 */
function detectLocale(): SupportedLocale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (isSupported(stored)) return stored
  } catch {
    // Private browsing / disabled storage — fall through to navigator.
  }

  const device = navigator.language?.split('-')[0]
  return isSupported(device ?? null) ? (device as SupportedLocale) : DEFAULT_LOCALE
}

export const i18n = createI18n({
  legacy: false,
  locale: detectLocale(),
  fallbackLocale: DEFAULT_LOCALE,
  messages,
  datetimeFormats,
  numberFormats,
})

/** Flips the global locale and remembers it. Used by LocaleSwitcher.vue. */
export function setLocale(locale: SupportedLocale): void {
  i18n.global.locale.value = locale
  document.documentElement.setAttribute('lang', locale)
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    // Not worth failing a language switch over.
  }
}
