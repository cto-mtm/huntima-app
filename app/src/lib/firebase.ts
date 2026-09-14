import type { Auth } from 'firebase/auth'
import { IS_LOCAL_API } from './api'

/**
 * Firebase Auth, used for STAFF only.
 *
 * Fans never touch this. They are anonymous by product design — no account,
 * no password, no download friction — and are identified by the device id in
 * stores/session.ts. Only the admin dashboard requires a real identity,
 * because only the admin dashboard can change what a whole stadium sees.
 *
 * EVERY import here is dynamic, and that is load-bearing, not style. A static
 * `import { getAuth } from 'firebase/auth'` pulls the Auth SDK into the entry
 * chunk — measured at +110 KB raw / +33 KB gzip — which every family would
 * download over stadium wifi to use a feature only staff can reach. Keep the
 * `import type` type-only (it is erased) and the value imports inside the
 * function.
 *
 * SEAM: when the server needs to *trust* fan progress (it must, before a real
 * prize is handed over — the claim code is forgeable today), the fan side
 * upgrades to Firebase anonymous auth and the device id becomes a fallback
 * rather than the identity. Deliberately not done yet: anonymous sign-in is a
 * network round trip, and progress must survive no signal.
 */

/**
 * Under the emulator any apiKey/projectId is accepted, and the `demo-` prefix
 * keeps the Auth emulator fully offline. In production these come from
 * VITE_FIREBASE_* — see .env.example.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? 'demo-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'localhost',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'demo-app',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? 'demo-app-id',
  // Required for Storage: without it getStorage() throws
  // storage/no-default-bucket and every upload fails before it starts.
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? 'demo-app.appspot.com',
}

/**
 * True when we are talking to the local Auth emulator rather than a project.
 *
 * Derived from the same IS_LOCAL_API that decides the API base, because the
 * two must agree: auth pointing at the emulator while data points at a
 * deployed function is a session the backend has never heard of.
 */
export const USING_AUTH_EMULATOR = import.meta.env.DEV && IS_LOCAL_API

let authPromise: Promise<Auth> | null = null

/** Loads the Auth SDK on first use and returns the shared instance. */
export function getFirebaseAuth(): Promise<Auth> {
  if (authPromise) return authPromise

  authPromise = (async () => {
    const { initializeApp } = await import('firebase/app')
    const { getAuth, connectAuthEmulator } = await import('firebase/auth')

    const auth = getAuth(initializeApp(firebaseConfig))

    if (USING_AUTH_EMULATOR) {
      // Same-origin, through the dev-server proxy (see vite.config.ts).
      // NOT a direct http://127.0.0.1:10099 connection: the Auth emulator
      // binds to localhost, so a direct URL resolves to the VIEWER's own
      // machine and fails on any device but this one — and it would be
      // mixed content under an https tunnel. One origin avoids both.
      connectAuthEmulator(auth, window.location.origin, { disableWarnings: true })
    }

    return auth
  })()

  return authPromise
}
