import { useI18n } from 'vue-i18n'
import type { MissionText } from 'shared'

/**
 * Resolves mission copy, which comes from two places that must not be mixed.
 *
 * `{ key }`  — the built-in demo campaign. An i18n message key, so it renders
 *              in the fan's language.
 * `{ text }` — words a staff member typed in the admin tool. User-generated
 *              content: shown verbatim, never translated, exactly like a
 *              fan's nickname. See docs/i18n.md § "Translate data".
 *
 * Every mission title or hint in a template goes through this. Reading
 * `mission.title.text` directly will render "undefined" for the demo hunt.
 */
export function useMissionText() {
  const { t } = useI18n()

  function resolve(value: MissionText): string {
    return 'key' in value ? t(value.key) : value.text
  }

  return { resolve }
}
