import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import type { DecodedIdToken } from 'firebase-admin/auth'

/**
 * Admin-SDK bootstrap and the admin gate.
 *
 * The Functions emulator sets FIREBASE_AUTH_EMULATOR_HOST for us, so
 * initializeApp() with no arguments talks to the local Auth emulator
 * locally and to the real project once deployed. No credentials either way.
 */
function ensureApp(): void {
  if (getApps().length === 0) initializeApp()
}

export interface AuthedUser {
  uid: string
  email: string | null
  isAdmin: boolean
}

/**
 * Verifies the `Authorization: Bearer <idToken>` header.
 *
 * Returns null when there is no token or the token is invalid/expired.
 * Never throws — a bad token is an expected condition, not an error.
 */
export async function verifyRequest(authorization: string | undefined): Promise<AuthedUser | null> {
  if (!authorization?.startsWith('Bearer ')) return null

  const idToken = authorization.slice('Bearer '.length).trim()
  if (!idToken) return null

  try {
    ensureApp()
    const decoded: DecodedIdToken = await getAuth().verifyIdToken(idToken)
    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      // The claim is the authority, NOT the email address. Checking a
      // domain or an allow-list of addresses here would be bypassable by
      // anyone who can create an account with that address.
      isAdmin: decoded.admin === true,
    }
  } catch {
    return null
  }
}

/** True only inside the Emulator Suite. Gates the seed endpoint below. */
export const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true'

/**
 * Creates (or repairs) the demo admin account in the Auth emulator.
 *
 * Exists because a fresh clone otherwise has no way to reach the admin
 * dashboard: the Auth emulator starts empty, and custom claims cannot be
 * set from the client SDK by design.
 *
 * MUST stay emulator-only. The caller checks `isEmulator` before routing
 * here, and this checks again — a single missed guard on an endpoint that
 * mints admin claims is not a recoverable mistake.
 */
export async function seedDemoAdmin(email: string, password: string): Promise<AuthedUser> {
  if (!isEmulator) throw new Error('seedDemoAdmin is emulator-only')

  ensureApp()
  const auth = getAuth()

  let uid: string
  try {
    const existing = await auth.getUserByEmail(email)
    uid = existing.uid
    await auth.updateUser(uid, { password })
  } catch {
    const created = await auth.createUser({ email, password })
    uid = created.uid
  }

  await auth.setCustomUserClaims(uid, { admin: true })
  return { uid, email, isAdmin: true }
}
