/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Base URL of the Cloud Functions `api` endpoint.
   *
   * Read ONLY in src/lib/api.ts — nowhere else. Vite inlines this at build
   * time, so it must be correct before you run `npm run build`.
   */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
