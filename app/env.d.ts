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
