# Huntima

A multi-tenant platform for verified photo hunts at live events. Each org
(ball club, company, wedding) gets a branded page at `/:tenantSlug`: fans scan
a QR code, recreate photo clues, collect badges, and redeem a prize —
captures are verified server-side by a vision model, so completions are
earned, not honor-system. Organizers run their own console at
`/:tenantSlug/admin`.

## What's in the box

- **`app/`** — Vue 3 + Vite + TypeScript SPA, Tailwind v4, Pinia, vue-router.
  Wrapped by **Capacitor 7** so the same `dist/` ships as an iOS/Android app.
- **`shared/`** — the zod contracts for every request and response, imported by
  both sides. One definition, parsed on both ends.
- **`firebase/`** — Firebase Hosting config plus a single Cloud Functions HTTP
  API (`api`), with **Emulator Suite** scripts for fully offline local dev.
- **Animation system** — Flutter-style hero/shared-element transitions built on
  the native **View Transitions API**. No animation library. See
  [`docs/animations.md`](docs/animations.md).
- **i18n** — vue-i18n in Composition API mode, per-feature TypeScript modules
  with compile-time key parity between locales. See [`docs/i18n.md`](docs/i18n.md).
- **Domain shell** — the fan flow (hub → mission → capture → trophy case →
  redeem) and the org console (branding, hunt builder, analytics, team) are
  real routes backed by Firestore, Cloud Storage and Firebase Auth, with
  captures judged by a vision model. A native camera viewfinder, geofencing
  and a server-authoritative badge ledger are deliberately still open; see
  [`docs/architecture.md`](docs/architecture.md) § "Seams left open".

## Quick start — fully local, no Firebase account

You do **not** need a Firebase project, `firebase login`, or any credentials.
The emulator scripts use the project id `demo-app`; any id prefixed `demo-`
makes the Emulator Suite run completely offline and never touch real resources.
That is why the project id in `.firebaserc` is irrelevant on day one.

```bash
# 0. One-time: the emulators are driven by the global CLI
npm i -g firebase-tools
```

```bash
# 1. Install every workspace from the repo root.
#    This also builds shared/, because npm runs its `prepare` script.
npm install
```

```bash
# 2. Start the emulated backend on :6001  (leave this running)
#    The script compiles the functions first.
npm run emulators
```

```bash
# 3. Seed a staff account, club branding and a published hunt
npm run seed
```

```bash
# 4. In a second terminal: start the web app
npm run dev
```

Open the app (the dev server prints the URL). To prove the whole app → API
path, open an org console and look at the **System** card on its Branding tab:
it calls `GET /health` on the emulated function and renders the response. (The
card used to sit on the fan-facing About screen, which is why that page no
longer shows one.)

The seed is idempotent — re-run it after every emulator restart, since the
Auth and Firestore emulators start empty.

Every command above runs from the repo root. You do **not** need an
`app/.env` for local dev: `src/lib/api.ts` falls back to the emulator URL in
dev builds. Copy `app/.env.example` to `app/.env` only when you need to point
at something else, or before a production build — Vite inlines the value at
build time.

### Daily workflow (two terminals)

For the tightest loop, let the builders and the emulator watch independently — the
emulator hot-reloads functions whenever `functions/lib/` changes. Add a
`npm run build:watch -w shared` terminal only if you are actively editing the
shared contracts:

```bash
# terminal 1
npm run build:watch -w firebase/functions
```

```bash
# terminal 2
npm run emulators:watch
```

```bash
# terminal 3
npm run dev
```

From `firebase/`, `npm run emulators:all` additionally serves the built app from `firebase/app/`
on :6000 for a production-like smoke test. Day-to-day dev uses Vite on :5173.
The Emulator UI is on :5000.

## Signing in

`/` is the signed-out marketing page. A fan normally arrives instead by
scanning an org's QR code, which lands them on that org's entry screen at
`/:tenantSlug/welcome`.

**Fans** tap *Continue as guest*. No account, no password — they get a device
id generated on-device (so it works with no signal) plus a nickname. An
account is optional and keeps their name and trophies across devices; *Switch
user* is on the org's About tab.

**Organizers** use the *Organizer sign in* link at the foot of the marketing
page, or the quieter *Staff sign-in* at the foot of an org's entry screen —
understated there because almost everyone on that screen is a family. It is
real Firebase Auth, and it creates accounts as well as signing them in: an
account that runs no org lands on `/orgs`, where it can start one. The Auth
emulator starts empty, so to get the pre-seeded operator account, seed it
first — either from a terminal:

```bash
npm run seed
```

or with the **Create demo admin** button on the login screen. Both create:

```
admin@demo.local / demo1234
```

That demo account carries the `admin` **custom claim**, which means *platform
operator* — support and ops, never a customer. Ordinary access to an org
console is a membership document at `tenants/{slug}/members/{uid}`, granted by
an owner on the console's Team tab. Neither is ever an email address: anyone
who can register that address would inherit the access.

The router guard only decides what UI to draw; the real gate is server-side
token verification, so forcing your way to a console yields a dashboard whose
privileged calls return 401/403. Try it:

```bash
curl -i http://127.0.0.1:6001/demo-app/us-central1/api/t/demo/admin/whoami
```

In dev, the entry screen also offers persona shortcuts that jump a fan
straight to a progress state (winner, already claimed, and so on) — reaching
the prize screen otherwise means capturing five missions by hand.

## How to add a hero transition

Three steps, no JavaScript:

1. On the **source** element (e.g. the block in `MissionCard.vue`), set an inline
   dynamic name: `:style="{ viewTransitionName: 'mission-' + mission.id }"`.
2. On the **target** element on the destination page, set the *same* name.
3. Navigate. The browser matches the names across the snapshot and morphs
   position, size and shape automatically.

The name must be unique per page at any moment — always derive it from an id,
never hardcode one inside a `v-for`. Full cookbook, including per-page custom
transitions and list animations: [`docs/animations.md`](docs/animations.md).

## How to add a translated string / a new locale

Strings live in per-feature TypeScript modules under `app/src/i18n/locales/`.
`en` is the source of truth; `es` is declared `const es: typeof en`, so a missing
or extra key is a **compile error**.

1. Open the module for the feature (e.g. `locales/pages/hub.ts`).
2. Add the key to **both** `en` and `es` in the same edit.
3. In the component: `const { t } = useI18n()`, then `t('hub.yourKey')`.

Adding a whole namespace or a third locale: [`docs/i18n.md`](docs/i18n.md).

## How to add an API endpoint

1. Add a zod schema to `shared/src/schemas.ts` and export it from
   `shared/src/index.ts`.
2. Add a route branch to the router in `firebase/functions/src/api.ts`.
3. Call it from the app with `apiFetch<T>('/your-path')` from `src/lib/api.ts`,
   or `useApi()` if you want `loading` / `error` refs.

It is testable immediately against the emulator — no deploy, no project.

## Going native

The web app and the native app are the same build. No code changes.

```bash
cd app && npm run build
npx cap add ios
npx cap add android
```

Drop a 1024×1024 `icon.png` and a 2732×2732 `splash.png` into `app/assets/`
(see [`app/assets/README.md`](app/assets/README.md)), then:

```bash
cd app && npm run cap:assets && npx cap sync && npx cap open ios
```

Two things are already handled for you:

- **CORS** — the API allow-list in `functions/src/helpers/cors.ts` already includes
  `capacitor://localhost` and `http://localhost`, which is what the iOS and
  Android shells send as `Origin`. Don't delete those entries.
- **Android back button** — handled in `app/src/lib/native.ts`. Without it the
  hardware/gesture back button closes the app from any page.

## Deploy

1. Put your real project id in `.firebaserc` (it currently reads
   `stadium-photo-hunt`, the name this repo carried before the product was
   renamed to Huntima).
2. Set `VITE_API_URL` in `app/.env` to the deployed function URL
   (`https://us-central1-<project-id>.cloudfunctions.net/api`). Vite inlines this
   at build time, so it must be right *before* you build.
3. Run the one true deploy path:

```bash
./scripts/deploy.sh
```

It builds `app/`, copies `dist/` to `firebase/app/` (where Hosting's `public`
points), and runs `firebase deploy`. It refuses to run while `.firebaserc` still
says `REPLACE_ME` or while `.env` points at localhost.

## White-labeling for a new team

Run the app and open **`/admin/branding`**. Set the team name, prize location,
brand color and accent color; the whole app re-skins live, with a WCAG contrast
check on the two color pairings that actually carry text.

The full ramp is derived from one hex, so there are no eight-tint palettes to
hand-maintain. To change what a *fresh install* looks like, edit
`app/src/config/tenant.ts`. Details and limits: [`docs/branding.md`](docs/branding.md).

> Branding currently saves to `localStorage`, per device, and `/admin` has no
> auth. Both are called out in `docs/branding.md` § Known limits.

## Keeping dependencies fresh

Versions in `package.json` are pinned to the dates this boilerplate was
generated. They're intentionally NOT auto-updated on install — the goal is
that `npm install && npm run dev` always works on day one.

Recommended workflow when starting a new project from this scaffold:

1. `npm install` in both `app/` and `firebase/functions/` and confirm
   `npm run dev` boots cleanly.
2. Commit the scaffold as your baseline (`git commit -m "initial scaffold"`).
3. Run `npm outdated` in each folder to see drift, and `npm audit` for
   security issues.
4. Upgrade deliberately — one major version at a time, testing between each.
   Watch especially for breaking changes in Vite, Capacitor, Tailwind,
   Firebase Functions, and zod (these have all shipped breaking majors in
   the past).
5. After upgrading, re-run `npm run dev`, click through the hero transition
   and the /about health check before committing.

Avoid running `npm update` blindly — it will pull breaking majors without
warning and you'll lose the "clean baseline" property.
