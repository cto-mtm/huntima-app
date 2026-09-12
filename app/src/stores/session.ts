import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
// Type-only: erased at compile time, so it costs the fan bundle nothing.
import type { User } from 'firebase/auth'
import { getFirebaseAuth } from '../lib/firebase'

const DEVICE_KEY = 'photo-hunt:device-id'
const ROLE_KEY = 'photo-hunt:role'

export type Role = 'anonymous' | 'guest' | 'admin'

/** Sentinel for "authenticated, but no admin claim". Not user-facing copy. */
export const NOT_STAFF = 'app/not-staff'

/**
 * Stable per-device identifier for guests.
 *
 * This is the fan's identity. It is generated once and never leaves the
 * device today, which is exactly why the claim code is forgeable — see the
 * seam note in lib/firebase.ts. Generating it here rather than server-side
 * is the deliberate trade: it works with no signal.
 */
function loadDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_KEY)
    if (existing) return existing
    const fresh = crypto.randomUUID()
    localStorage.setItem(DEVICE_KEY, fresh)
    return fresh
  } catch {
    // Private browsing: a per-session id is still better than none, it just
    // will not survive a reload.
    return crypto.randomUUID()
  }
}

function loadRole(): Role {
  try {
    const stored = localStorage.getItem(ROLE_KEY)
    // 'admin' is never restored from storage — it is only ever granted by a
    // live Firebase session below. Trusting a stored role would make the
    // whole gate a localStorage edit away.
    return stored === 'guest' ? 'guest' : 'anonymous'
  } catch {
    return 'anonymous'
  }
}

export const useSessionStore = defineStore('session', () => {
  const deviceId = ref(loadDeviceId())
  const role = ref<Role>(loadRole())

  const adminUser = ref<User | null>(null)
  const adminEmail = computed(() => adminUser.value?.email ?? null)

  const authReady = ref(false)
  const signingIn = ref(false)
  const authError = ref<string | null>(null)

  const isGuest = computed(() => role.value === 'guest')
  const isAdmin = computed(() => role.value === 'admin')
  const isAnonymous = computed(() => role.value === 'anonymous')

  function persistRole(next: Role): void {
    try {
      // Only 'guest' is persisted; see loadRole().
      if (next === 'guest') localStorage.setItem(ROLE_KEY, 'guest')
      else localStorage.removeItem(ROLE_KEY)
    } catch {
      // Non-fatal: the session still works for this tab.
    }
  }

  function continueAsGuest(): void {
    role.value = 'guest'
    adminUser.value = null
    persistRole('guest')
  }

  let readyPromise: Promise<void> | null = null

  /**
   * Starts the Firebase auth watcher and resolves once the first auth state
   * has arrived. Router guards await this so a staff member who reloads
   * /admin/branding is not bounced to the login screen before Firebase has
   * had a chance to restore their session.
   *
   * Lazy on purpose: a fan session never initializes the Auth SDK at all.
   */
  function ensureAuthReady(): Promise<void> {
    if (readyPromise) return readyPromise

    readyPromise = new Promise<void>((resolve) => {
      void (async () => {
        const auth = await getFirebaseAuth()
        const { onAuthStateChanged, signOut } = await import('firebase/auth')

        onAuthStateChanged(auth, async (user) => {
          if (!user) {
            adminUser.value = null
            if (role.value === 'admin') role.value = 'anonymous'
            authReady.value = true
            resolve()
            return
          }

          const token = await user.getIdTokenResult()

          if (token.claims.admin === true) {
            // The verified claim is the authority — never the email address,
            // and never anything the client stored.
            adminUser.value = user
            role.value = 'admin'
          } else {
            // Signed in, but not staff. Refuse rather than silently
            // downgrading to guest, which would read as a wrong password.
            adminUser.value = null
            authError.value = NOT_STAFF
            role.value = 'anonymous'
            await signOut(auth)
          }

          authReady.value = true
          resolve()
        })
      })()
    })

    return readyPromise
  }

  async function signInAsAdmin(email: string, password: string): Promise<boolean> {
    signingIn.value = true
    authError.value = null
    try {
      const auth = await getFirebaseAuth()
      const { signInWithEmailAndPassword } = await import('firebase/auth')
      await signInWithEmailAndPassword(auth, email, password)
      return true
    } catch (err) {
      // Keep the Firebase error CODE, not the prose: the page needs to tell
      // "unreachable" apart from "wrong password" (reporting a network
      // failure as bad credentials sends people hunting for a typo that is
      // not there) while still collapsing every credential-ish failure into
      // one message, so we never reveal which emails exist.
      const code = (err as { code?: string } | null)?.code
      authError.value = code ?? (err instanceof Error ? err.message : 'Sign-in failed')
      return false
    } finally {
      signingIn.value = false
    }
  }

  /** Returns the current ID token for authenticated API calls, if any. */
  async function getIdToken(): Promise<string | null> {
    const user = adminUser.value
    if (!user) return null
    try {
      return await user.getIdToken()
    } catch {
      return null
    }
  }

  async function signOutAll(): Promise<void> {
    if (adminUser.value) {
      const auth = await getFirebaseAuth()
      const { signOut } = await import('firebase/auth')
      await signOut(auth)
    }
    adminUser.value = null
    role.value = 'anonymous'
    persistRole('anonymous')
  }

  return {
    deviceId,
    role,
    adminUser,
    adminEmail,
    authReady,
    signingIn,
    authError,
    isGuest,
    isAdmin,
    isAnonymous,
    continueAsGuest,
    ensureAuthReady,
    signInAsAdmin,
    getIdToken,
    signOutAll,
  }
})
