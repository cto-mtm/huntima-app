import { createI18n } from 'vue-i18n'

// ── Namespace modules ─────────────────────────────────────────────────
// Each module exports { en, es } and registers under its file name.
// Adding a namespace = one import + one line in each messages block.
import common from './locales/configs/common'
import shell from './locales/components/shell'
import missionCard from './locales/components/missionCard'
import trophyCase from './locales/components/trophyCase'
import hub from './locales/pages/hub'
import mission from './locales/pages/mission'
import capture from './locales/pages/capture'
import redeem from './locales/pages/redeem'
import about from './locales/pages/about'
import notFound from './locales/pages/notFound'
import admin from './locales/pages/admin'
import entry from './locales/pages/entry'
import hunts from './locales/pages/hunts'
import profile from './locales/pages/profile'
import landing from './locales/pages/landing'
import orgs from './locales/pages/orgs'

export const SUPPORTED_LOCALES = ['en', 'es'] as const
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

/**
 * Language names, written in their OWN language.
 *
 * Deliberately not i18n keys. A Spanish speaker scanning for their language
 * looks for "Español", not for the Spanish word for "Spanish" — and certainly
 * not for "Spanish" rendered in an English UI they cannot read. Autonyms are
 * the same in every locale, which is exactly why they are a constant.
 */
export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: 'English',
  es: 'Español',
}

/** `en` is the authored source of truth; `es` is typed against it per module. */
export const DEFAULT_LOCALE: SupportedLocale = 'en'

const messages = {
  en: {
    common: common.en,
    shell: shell.en,
    missionCard: missionCard.en,
    trophyCase: trophyCase.en,
    hub: hub.en,
    mission: mission.en,
    capture: capture.en,
    redeem: redeem.en,
    about: about.en,
    notFound: notFound.en,
    admin: admin.en,
    entry: entry.en,
    hunts: hunts.en,
    profile: profile.en,
    landing: landing.en,
    orgs: orgs.en,
  },
  es: {
    common: common.es,
    shell: shell.es,
    missionCard: missionCard.es,
    trophyCase: trophyCase.es,
    hub: hub.es,
    mission: mission.es,
    capture: capture.es,
    redeem: redeem.es,
    about: about.es,
    notFound: notFound.es,
    admin: admin.es,
    entry: entry.es,
    hunts: hunts.es,
    profile: profile.es,
    landing: landing.es,
    orgs: orgs.es,
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

const STORAGE_KEY = 'huntima:locale'

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

/**
 * Keeps <html lang> in step with the active locale.
 *
 * This is not cosmetic. A `lang` that contradicts the rendered text makes
 * browsers distrust it and sniff the content instead — and content sniffing
 * on a short page full of loanwords ("Missions", "Continue", a French-derived
 * place name) cheerfully guesses the wrong language and offers to translate a
 * page that was never in that language. It also decides which voice a screen
 * reader uses, so a mismatch makes Spanish copy read aloud in an English one.
 */
function syncDocumentLang(locale: SupportedLocale): void {
  document.documentElement.setAttribute('lang', locale)
}

export const i18n = createI18n({
  legacy: false,
  locale: detectLocale(),
  fallbackLocale: DEFAULT_LOCALE,
  messages,
  datetimeFormats,
  numberFormats,
})

// index.html can only hardcode one value, and the detected locale is not
// known until now — so sync it immediately, not just when someone switches.
syncDocumentLang(i18n.global.locale.value as SupportedLocale)

/** Flips the global locale and remembers it. Used by LocaleSwitcher.vue. */
export function setLocale(locale: SupportedLocale): void {
  i18n.global.locale.value = locale
  syncDocumentLang(locale)
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    // Not worth failing a language switch over.
  }
}
