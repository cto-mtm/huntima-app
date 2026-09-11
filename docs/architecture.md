# Architecture

One page on how the pieces fit together.

## The shape of it

```
app/src ──vite build──> app/dist ──┬── scripts/deploy.sh copies to ──> firebase/app ──> Firebase Hosting
                                   │
                                   └── cap sync packages into ──────> iOS / Android shells
                                                                       (capacitor.config.ts: webDir: 'dist')
                     │
                     └── JSON over HTTPS ──> Cloud Function `api` (us-central1)
                                              locally: Emulator Suite on :5001
```

`shared/` sits under both arms: the app imports its zod schemas at build time,
and esbuild inlines them into the function. One contract, two consumers.

**One build artifact, three destinations.** `app/dist/` is what Hosting serves,
what Capacitor packages, and what `npm run preview` serves. There is no
web-vs-native fork in the source.

## Frontend

Vue 3 (`<script setup>`, TypeScript strict) + vue-router with `createWebHistory`
(real URLs, no hash) + Pinia for state + Tailwind v4 via the Vite plugin.

- **Routing** — Every navigation is wrapped in `document.startViewTransition` by
  a `beforeResolve` guard in `src/router/index.ts`. Pages opt into effects purely
  through CSS; the router file never changes per-page. Unsupported browsers and
  `prefers-reduced-motion` users get instant navigation, which is the designed
  fallback, not a bug. See [`animations.md`](animations.md).
- **State** — `stores/missions.ts` holds the seeded campaign; `stores/progress.ts`
  holds the fan's nickname, avatar and earned badges. Both are in-memory.
- **Strings** — everything user-facing flows through vue-i18n. Seed data stores
  message *keys*, never display text. See [`i18n.md`](i18n.md).
- **Safe areas** — `AppShell.vue` pads header and bottom nav with
  `env(safe-area-inset-*)`, and `index.html` sets `viewport-fit=cover`, so the
  same markup is correct in a browser and under an iPhone notch.
- **Native glue** — `lib/native.ts` is the single place Capacitor plugins are
  touched. It registers the Android back button handler and is a no-op in the
  browser (`Capacitor.isNativePlatform()` guard).

## Backend

A single v2 `onRequest` function named `api`, with hand-rolled routing — no
Express, to keep the cold-start dependency surface minimal.

- Region `us-central1`, `maxInstances: 10`.
- Request bodies are validated with **zod**; a `ZodError` becomes a 400 carrying
  `error.flatten()`, so the client gets field-level detail.
- CORS is an explicit allow-list. It includes `capacitor://localhost` and
  `http://localhost` because those are the Origins the iOS and Android shells
  send. Deleting them breaks the native apps and nothing else — which is exactly
  why it is easy to delete by accident.

Routes today: `GET /health`, `GET /missions`, `POST /echo`.

## Shared contracts

`shared/` is an npm workspace holding the zod schemas for every request and
response. The API parses against them before responding; the client parses
against them before rendering. There is one definition, so the two ends cannot
drift.

The reason this needs explaining is the deploy story. **Firebase Functions
deployment does not follow workspace symlinks** — `firebase deploy` uploads the
`source` directory to Cloud Build, where a `node_modules/shared` symlink
pointing outside that directory is dead. So:

- The function is **bundled with esbuild**, not just compiled. `shared` and zod
  are inlined into `lib/index.js`, which is therefore self-contained. `tsc` is
  demoted to `--noEmit` type-checking.
- `shared` is a **devDependency** of `functions`, never a dependency. Cloud
  Build installs `dependencies` from the registry, where `shared` does not
  exist; as a build-time-only dep that is bundled away, it is never installed.
  The same goes for zod.
- Only `firebase-functions` and `firebase-admin` stay external and remain real
  runtime dependencies.

Bundling is a bonus for cold starts, which matter here: traffic arrives in a
spike when the jumbotron shows the QR code.

The alternative — packing `shared` to a tarball in a `predeploy` hook — avoids
the bundler but adds a script that breaks quietly. Bundling was the call.

## Local development

The emulator scripts pass `--project demo-app`. Any project id prefixed with
`demo-` puts the Emulator Suite in fully offline mode: it never reaches real
Firebase resources and needs no `firebase login`. This is what makes the repo
runnable on a fresh machine with `.firebaserc` still saying `REPLACE_ME`.

The app finds the API through `VITE_API_URL` (read **only** in `src/lib/api.ts`).
If it is unset, `api.ts` falls back to the emulator URL in dev builds and to the
production Cloud Functions URL in prod builds — so `npm run dev` works even if
you forget to copy `.env.example`.

## Hosting config notes

- `hosting.public` is `"app"` — that is `firebase/app/`, which `scripts/deploy.sh`
  creates by copying `app/dist/`. It is generated and gitignored.
- The SPA rewrite (`** → /index.html`) is required because the app uses
  `createWebHistory`. Without it, a hard refresh on `/missions/3` 404s.
- That same rewrite is why the router needs a catch-all 404 route: Hosting hands
  *every* unmatched URL to the SPA, so a typo would otherwise render an empty
  `<RouterView>`.

## Seams left open

This scaffold is the fan-facing shell. The following are intentionally absent,
each with a marked seam:

| Missing | Seam | Note |
|---|---|---|
| Firestore campaign storage | `GET /missions` in `functions/src/api.ts` returns `SEED_CAMPAIGN`; `stores/missions.ts` fetches it | Swap the constant for a Firestore query; `missionListSchema` is the contract and doesn't change |
| Mission photo uploads | `mission.imageUrl` is `null` in the seed; `MissionCard.vue` renders a colored block when it is | Point it at a Cloud Storage download URL |
| Camera capture | `CapturePage.vue` `simulateCapture()` | Replace with `@capacitor/camera`; keep the same `progress.awardBadge()` call |
| Geofence validation | `CapturePage.vue`, same function | `@capacitor/geolocation` + a point-in-radius check against tenant config, verified server-side |
| OCR "spyglass" missions | `mission.kind === 'spyglass'` branch in `CapturePage.vue` | The UI branch exists; the verification call does not |
| Admin campaign builder & dashboard | Nothing | A separate route tree and a second Hosting target; needs auth first |
| Auth | Nothing | Fans are anonymous by design; admin is not |

Resist adding these speculatively. Each one drags in a real decision (storage
rules, PII retention, prize fraud) that belongs in its own change.

## When you need deep links

Opening `https://yourdomain/missions/3` directly into the installed native app
requires platform association, not just routing:

- **iOS** — an `apple-app-site-association` file served from your domain plus the
  Associated Domains entitlement in Xcode.
- **Android** — an `assetlinks.json` file plus `<intent-filter>` entries in the
  manifest.

It is deliberately not scaffolded, because it can't be tested without real
domains and signing certificates. The SPA routes are already shaped to support
it (real paths, stable ids, catch-all 404). See the official guide:
<https://capacitorjs.com/docs/guides/deep-links>.
