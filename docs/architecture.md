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
                                              locally: Emulator Suite on :6001
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
- **State** — `stores/missions.ts` hydrates the campaign from `GET /missions`
  (falling back to the seed when the network fails); `stores/progress.ts` holds
  the fan's nickname, avatar and earned badges. That one is device-local
  (`localStorage`) for guests; a signed-in fan also has it synced to the server
  (`/me/progress`) so their trophies follow them to a new phone — but it stays
  *self-reported*, not server-authoritative. See the seam table below.
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
- **The allow-list is not enforced by the emulator.** The Functions emulator
  wraps every function in its own permissive CORS middleware that echoes any
  Origin, so a local curl proves nothing about it. Verify CORS on a deployed
  function only. See the comment in `functions/src/helpers/cors.ts`.

**Multi-tenant since the platform pivot** (see `docs/platform-migration.md`):
an org's slug is in every URL — `tenants/{slug}` in Firestore, `/t/:slug/…`
on the wire, `/:tenantSlug/…` in the app. Org access is a membership
document (`tenants/{slug}/members/{uid}`), not a claim; the `admin` claim
now means *platform operator* and bypasses membership everywhere.

Routes today: public `GET /health`, `POST /echo`, `GET /t/:slug/tenant`,
`GET /t/:slug/missions`, `POST /t/:slug/verify-capture` (per-IP and
per-tenant rate limits), `POST /t/:slug/campaigns/:id/events`; authenticated
`GET|PUT /me/progress`, `GET /me/orgs`; operator-only `POST /orgs`;
member-gated `PUT /t/:slug/admin/tenant`, `GET /t/:slug/admin/whoami`,
`GET|POST /t/:slug/admin/members`, the `GET|POST|PATCH|DELETE
/t/:slug/admin/campaigns[/:id]` CRUD, `PUT
/t/:slug/admin/campaigns/:id/missions`, and `GET
/t/:slug/admin/campaigns/:id/stats`; and the emulator-only
`POST /dev/seed-admin`.

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

## Identity

Two audiences, deliberately asymmetric.

**Fans are anonymous.** No account, no password, no download — that is the
product requirement, not a shortcut. A fan is a `crypto.randomUUID()` device
id in localStorage (`stores/session.ts`) plus a nickname. It is generated
on-device so it works with no signal, which a concourse frequently has.

**Staff authenticate for real.** Firebase Auth email/password, and the
`admin` custom claim — not the email address — is what grants access. The
router guard is convenience; the actual gate is server-side token
verification in `functions/src/helpers/auth.ts`. Forcing your way to
`/admin` gets you a dashboard whose privileged calls all return 401/403.

The Auth SDK is loaded through dynamic imports only. A static import puts
~129 KB into the entry chunk that every family would download over stadium
wifi for a feature only staff can reach.

Locally the Auth emulator runs on :10099 and starts empty. `POST
/dev/seed-admin` creates the demo account — gated on `FUNCTIONS_EMULATOR`,
checked twice, because a route that mints admin claims is not a recoverable
mistake. In the emulator that route needs no auth of its own: anyone who can
reach your localhost can already do worse.

## Hunts, assets and capture verification

A **hunt** is a Firestore document in `campaigns/`, with its missions embedded
rather than in a subcollection: a hunt has a handful of steps, every read
wants all of them, and publishing must be atomic — a fan must never see a
half-edited hunt. Only a `published` hunt is served; everything else is a
draft nobody can see. With no published hunt, `GET /missions` falls back to
the built-in demo campaign, so a fresh install never shows an empty app to a
family that just scanned a QR code.

Mission copy comes from two places and they must not be mixed. The demo hunt
uses i18n **keys** so it renders in the fan's language; staff-authored hunts
carry literal **text**, which is user-generated content and is never
translated. `missionTextSchema` is a union so "neither" and "both" cannot be
expressed, and `useMissionText()` is the only thing that resolves either.

**Storage** holds two public things — team assets and mission target photos —
both staff-write, world-read, because fans are anonymous and their app has to
render them. A mission's target photo does double duty: it is the clue the fan
is shown AND the reference their capture is compared against.

**Fan captures are never stored.** The photo is downscaled to 1024px in the
browser (which also strips the GPS coordinates phones embed by default), sent
in the body of `POST /verify-capture`, forwarded to Gemini, and discarded with
the request. These are photographs of children in a public venue: what you do
not store cannot leak, and there is no deletion request to service.
`storage.rules` denies the write path outright rather than relying on the
client not to try.

Verification is **server-authoritative**. The client used to award its own
badges, which is the same as letting it mint prizes. The Gemini key lives in
the function, never the bundle. With no key configured the endpoint returns a
stub verdict flagged `stubbed: true`, so the whole flow is testable before
anyone has an account.

A non-match is a **strict gate**: no badge, try again. Every failure that is
OUR fault — model outage, timeout, unreachable target image — deliberately
returns a match instead, because a child should never lose a badge to our
broken URL. Since captures are not stored, a disputed rejection has no
evidence behind it; a staff override is the missing pressure valve and is the
next thing to build.

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

Most of the backend is now wired: Firestore (tenant, hunts, missions), Cloud
Storage (assets, target photos), Firebase Auth with the `admin` claim, the
admin hunt builder, server-authoritative capture verification, and aggregate
per-hunt analytics. What remains deliberately open, each with a marked seam:

| Missing | Seam | Note |
|---|---|---|
| Native camera viewfinder | `CapturePage.vue` uses a file input with `capture="environment"` | Works today and degrades to a desktop file picker; `@capacitor/camera` would buy a nicer in-app viewfinder, not a new capability |
| Geofence validation | `CapturePage.vue` | `@capacitor/geolocation` + a point-in-radius check against tenant config, verified server-side |
| OCR "spyglass" verification | `mission.kind === 'spyglass'` | The capture UI distinguishes spyglass missions, but they share the photo verification path — there is no OCR-specific server check yet |
| Server-*trusted* fan progress | `stores/progress.ts` now syncs a signed-in fan's progress to `fan_progress/{uid}` via `/me/progress`, but the server stores what the client claims; `claimCode` is still derived, not issued | Cross-device *continuity* is done (a signed-in fan's trophies follow them; guests stay device-local). What is still open is *authority*: the server does not yet own the badge ledger (awarding badges on a verified capture) or mint/invalidate claim codes, so progress must never hand over a prize without staff verification. **Analytics stays aggregate-only** (`campaign_stats/` counters, no per-person row): `fan_progress` is opt-in and self-reported, so it is not a trusted per-fan identity to attribute analytics to — and storing behavioural data on minors is its own decision |

Resist closing these speculatively. Each drags in a real decision (PII
retention, prize fraud) that belongs in its own change.

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
