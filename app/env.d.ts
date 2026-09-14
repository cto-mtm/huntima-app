/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Base URL of the Cloud Functions `api` endpoint.
   *
   * Read ONLY in src/lib/api.ts — nowhere else. Vite inlines this at build
   * time, so it must be correct before you run `npm run build`.
   */
  readonly VITE_API_URL?: string

  /**
   * Firebase project config, used by STAFF auth only (src/lib/firebase.ts).
   * All optional: with them unset the app targets the offline `demo-app`
   * Auth emulator, which accepts any key. Required for a real deployment.
   */
  readonly VITE_FIREBASE_API_KEY?: string
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string
  readonly VITE_FIREBASE_PROJECT_ID?: string
  readonly VITE_FIREBASE_APP_ID?: string
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string

  /**
   * Public origin of the deployed app, e.g. `https://huntima.app`.
   *
   * Read ONLY in src/lib/publicUrl.ts, which backs the shareable fan-page
   * link and QR code in the org console. Unset is correct for browser
   * builds — the current origin is then used, so a code generated in dev
   * points at dev. A NATIVE build must set it: inside Capacitor the origin
   * is `capacitor://localhost`, which is not an address a fan can open.
   */
  readonly VITE_PUBLIC_BASE_URL?: string

  /**
   * Non-empty when the app is running in remote (CodePipe / Tailscale) dev
   * mode. Injected by vite.config.ts from the TAILSCALE_HOST env var that the
   * `dev:remote` script sets. Used to force same-origin, https-safe backend
   * connections. Empty string in local dev and production.
   */
  readonly VITE_TAILSCALE_HOST?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
