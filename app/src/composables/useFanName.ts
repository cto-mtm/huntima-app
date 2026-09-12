import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useProgressStore } from '../stores/progress'
import { useSessionStore } from '../stores/session'

/**
 * What to call the person playing.
 *
 * Three sources, in order of how much they mean:
 *   1. a name they typed on their profile — an explicit choice
 *   2. the name their auth provider gave us — Google supplies one, email
 *      sign-up does not
 *   3. "Guest" — the honest answer, and a translated one
 *
 * Onboarding no longer asks for a name. A family scanning a QR code at the
 * gate should be playing in one tap; naming yourself is something you do once
 * you care, from the profile screen.
 */
export function useFanName() {
  const { t } = useI18n()
  const progress = useProgressStore()
  const session = useSessionStore()

  /** Empty when nobody has chosen or been given a name. */
  const chosenName = computed(
    () => progress.nickname.trim() || session.providerName?.trim() || '',
  )

  /** Always renders something. Use this in copy. */
  const displayName = computed(() => chosenName.value || t('common.guest'))

  /** For the avatar monogram. */
  const initial = computed(() => displayName.value.trim().charAt(0).toUpperCase() || '?')

  return { chosenName, displayName, initial }
}
