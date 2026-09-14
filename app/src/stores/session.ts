import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
// Type-only: erased at compile time, so it costs the fan bundle nothing.
// Every VALUE import from firebase/auth in this file is dynamic on purpose —
// see the note in lib/firebase.ts.
import type { User } from 'firebase/auth'
import { getFirebaseAuth } from '../lib/firebase'

const DEVICE_KEY = 'huntima:device-id'
const ROLE_KEY = 'huntima:role'
/**
 * Set once anybody signs in on this device, and never cleared by a sign-out
 * of convenience — it only records that an account has been used here.
 *
 * It exists to decide whether to load the Auth SDK at boot. Loading it for
 * everyone costs ~129 KB on a stadium connection for a feature most fans
 * never touch; not loading it at all means a signed-in fan is never
 * recognised when they come back. This flag buys both.
 */
const ACCOUNT_SEEN_KEY = 'huntima:has-account'

/**
 * `guest` — no account at all. The default, and the fast path: a family
 *           scanning a QR code at the gate should be playing in one tap.
 * `fan`   — signed in with Google or email. Real identity, a name from the
 *           provider, still an ordinary player.
 * `admin` — carries the verified `admin` custom claim. Staff.
 */
export type Role = 'anonymous' | 'guest' | 'fan' | 'admin'

/**
 * Stable per-device identifier.
 *
 * Still the identity for guests, and still generated on-device so it works
 * with no signal — a concourse frequently has none. A signed-in fan also has
 * a uid, which is the one that could eventually follow them to a new phone.
 */
function loadDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_KEY)
    if (existing) return existing
    const fresh = crypto.randomUUID()
    localStorage.setItem(DEVICE_KEY, fresh)
    return fresh
  } catch {
    return crypto.randomUUID()
  }
}

function loadRole(): Role {
  try {
    // Only `guest` is ever restored from storage. `fan` and `admin` are
    // granted by a live Firebase session, because a role read back from
    // localStorage is a role anybody can type into devtools.
    return localStorage.getItem(ROLE_KEY) === 'guest' ? 'guest' : 'anonymous'
  } catch {
    return 'anonymous'
  }
}

export const useSessionStore = defineStore('session', () => {
  const deviceId = ref(loadDeviceId())
  const role = ref<Role>(loadRole())

  const user = ref<User | null>(null)
  const email = computed(() => user.value?.email ?? null)
  /** Name from the auth provider. Google supplies one; email sign-up does not. */
  const providerName = computed(() => user.value?.displayName ?? null)

  const authReady = ref(false)
  const busy = ref(false)
  const authError = ref<string | null>(null)

  const isGuest = computed(() => role.value === 'guest')
  const isFan = computed(() => role.value === 'fan')
  const isAdmin = computed(() => role.value === 'admin')
  /** Anyone who may play: guests, signed-in fans, AND operators/org members.
   *  Running an org and playing a hunt are two hats on one account — the
   *  platform's premise — so holding the operator claim must never lock
   *  someone out of the fan experience. */
  const canPlay = computed(
    () => role.value === 'guest' || role.value === 'fan' || role.value === 'admin',
  )

  function persistRole(next: Role): void {
    try {
      if (next === 'guest') localStorage.setItem(ROLE_KEY, 'guest')
      else localStorage.removeItem(ROLE_KEY)
    } catch {
      // Non-fatal: the session still works for this tab.
    }
  }

  /** True when an account has been used on this device before. */
  function hasUsedAccount(): boolean {
    try {
      return localStorage.getItem(ACCOUNT_SEEN_KEY) === '1'
    } catch {
      return false
    }
  }

  function rememberAccountUsed(): void {
    try {
      localStorage.setItem(ACCOUNT_SEEN_KEY, '1')
    } catch {
      // Non-fatal: the session still works, it just will not be restored.
    }
  }

  function continueAsGuest(): void {
    role.value = 'guest'
    persistRole('guest')
  }

  let readyPromise: Promise<void> | null = null

  /**
   * Watches the Firebase session and derives the role from the verified
   * `admin` claim — never from an email address, and never from storage.
   *
   * A signed-in account WITHOUT the claim is a fan, not an error. It used to
   * be force-signed-out here, which was right when staff were the only people
   * who could sign in and is wrong now that fans can.
   */
  function ensureAuthReady(): Promise<void> {
    if (readyPromise) return readyPromise

    readyPromise = new Promise<void>((resolve) => {
      void (async () => {
        const auth = await getFirebaseAuth()
        const { onAuthStateChanged, getRedirectResult } = await import('firebase/auth')

        // Complete any redirect-based Google sign-in (the COOP fallback in
        // signInWithGoogle). Safe to call always: it resolves to null when we
        // did not just come back from a redirect. onAuthStateChanged below
        // still fires with the user, so this is only about surfacing errors
        // and forcing the pending redirect to settle before we resolve.
        try {
          await getRedirectResult(auth)
        } catch (err) {
          captureError(err)
        }

        onAuthStateChanged(auth, async (next) => {
          if (!next) {
            user.value = null
            // Fall back to a stored guest session rather than stranding
            // someone on the entry screen after a sign-out.
            if (role.value === 'admin' || role.value === 'fan') role.value = loadRole()
            authReady.value = true
            resolve()
            return
          }

          const token = await next.getIdTokenResult()
          user.value = next
          role.value = token.claims.admin === true ? 'admin' : 'fan'
          rememberAccountUsed()

          authReady.value = true
          resolve()
        })
      })()
    })

    return readyPromise
  }

  /** Shared failure handling: keep the CODE, never the provider's prose. */
  function captureError(err: unknown): false {
    const code = (err as { code?: string } | null)?.code
    authError.value = code ?? (err instanceof Error ? err.message : 'Sign-in failed')
    return false
  }

  async function signInWithGoogle(): Promise<boolean> {
    busy.value = true
    authError.value = null
    try {
      const auth = await getFirebaseAuth()
      const { GoogleAuthProvider, signInWithPopup, signInWithRedirect } = await import(
        'firebase/auth'
      )
      const provider = new GoogleAuthProvider()
      try {
        await signInWithPopup(auth, provider)
        return true
      } catch (popupErr) {
        // COOP severs the popup's opener relationship, so the SDK cannot read
        // the result back or close the window ("Cross-Origin-Opener-Policy
        // policy would block the window.close call"). It surfaces as one of
        // these codes. Fall back to the full-page redirect flow, which never
        // touches window.opener/close. This call navigates away; the result
        // is picked up by getRedirectResult() in ensureAuthReady() on return.
        const code = (popupErr as { code?: string } | null)?.code
        const popupUnusable =
          code === 'auth/popup-blocked' ||
          code === 'auth/popup-closed-by-user' ||
          code === 'auth/cancelled-popup-request' ||
          code === 'auth/web-storage-unsupported' ||
          code === 'auth/operation-not-supported-in-this-environment'
        if (popupUnusable) {
          await signInWithRedirect(auth, provider)
          // Redirect navigates away; nothing after this runs in practice.
          return true
        }
        throw popupErr
      }
    } catch (err) {
      return captureError(err)
    } finally {
      busy.value = false
    }
  }

  async function signInWithEmail(address: string, password: string): Promise<boolean> {
    busy.value = true
    authError.value = null
    try {
      const auth = await getFirebaseAuth()
      const { signInWithEmailAndPassword } = await import('firebase/auth')
      await signInWithEmailAndPassword(auth, address, password)
      return true
    } catch (err) {
      return captureError(err)
    } finally {
      busy.value = false
    }
  }

  /**
   * Sends a password-reset email.
   *
   * Always reports success, whatever Firebase says. A form that distinguishes
   * "sent" from "no such account" is an account-enumeration oracle, and the
   * person who mistyped their address learns the same thing from the email
   * that never arrives. Errors are still surfaced for the one case worth
   * separating: the service being unreachable.
   */
  async function sendPasswordReset(address: string): Promise<boolean> {
    busy.value = true
    authError.value = null
    try {
      const auth = await getFirebaseAuth()
      const { sendPasswordResetEmail } = await import('firebase/auth')
      await sendPasswordResetEmail(auth, address)
      return true
    } catch (err) {
      const code = (err as { code?: string } | null)?.code
      if (code === 'auth/network-request-failed') return captureError(err)
      return true
    } finally {
      busy.value = false
    }
  }

  async function createAccount(address: string, password: string): Promise<boolean> {
    busy.value = true
    authError.value = null
    try {
      const auth = await getFirebaseAuth()
      const { createUserWithEmailAndPassword } = await import('firebase/auth')
      await createUserWithEmailAndPassword(auth, address, password)
      return true
    } catch (err) {
      return captureError(err)
    } finally {
      busy.value = false
    }
  }

  /** Current ID token, for authenticated API calls. Null for guests. */
  async function getIdToken(): Promise<string | null> {
    if (!user.value) return null
    try {
      return await user.value.getIdToken()
    } catch {
      return null
    }
  }

  async function signOutAll(): Promise<void> {
    if (user.value) {
      const auth = await getFirebaseAuth()
      const { signOut } = await import('firebase/auth')
      await signOut(auth)
    }
    user.value = null
    role.value = 'anonymous'
    persistRole('anonymous')
  }

  return {
    deviceId,
    role,
    hasUsedAccount,
    user,
    email,
    providerName,
    authReady,
    busy,
    authError,
    isGuest,
    isFan,
    isAdmin,
    canPlay,
    continueAsGuest,
    ensureAuthReady,
    signInWithGoogle,
    signInWithEmail,
    createAccount,
    sendPasswordReset,
    getIdToken,
    signOutAll,
  }
})
