import { onScopeDispose, readonly, ref } from 'vue'

const QUERY = '(prefers-reduced-motion: reduce)'

/**
 * Reactive `prefers-reduced-motion`. Reactive, not read-once, because the
 * user can flip the OS setting while the app is open.
 *
 * The router and transitions.css already honor this. Use the composable
 * only when JS needs to branch — e.g. skipping a celebratory animation
 * delay so the reward appears instantly instead.
 */
export function useReducedMotion() {
  const mql = window.matchMedia(QUERY)
  const reduced = ref(mql.matches)

  const onChange = (e: MediaQueryListEvent) => {
    reduced.value = e.matches
  }

  mql.addEventListener('change', onChange)
  onScopeDispose(() => mql.removeEventListener('change', onChange))

  return readonly(reduced)
}
