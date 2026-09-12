# Photo Hunt

A white-label "digital passport" web app for live sporting events. Fans scan a
QR code on the jumbotron, get a list of photo missions around the concourse,
capture them, and collect badges toward a redeemable prize.

Mobile-first browser app today; ships as an iOS/Android app via Capacitor with
zero restructuring.

## Project Structure

- `shared/` — zod contracts for the app/API wire format. Both sides import
  these; never redeclare a schema in either package.
- `app/` — Vue 3 + Vite web app, wrapped by Capacitor for iOS/Android
- `firebase/` — Firebase Hosting config + Cloud Functions API + emulator scripts
- `docs/` — Internal documentation (read `docs/animations.md` before touching any
  animation, `docs/i18n.md` before touching any user-facing string,
  `docs/architecture.md` for how the pieces fit and what is deliberately not built yet,
  `docs/branding.md` before touching anything brand- or color-related)

## Current state: domain shell, not the finished product

The fan-facing flow (hub → mission → capture → trophy case → redeem) exists as
real routes, real components, and real i18n copy, driven by **seeded local
state** in Pinia. The following are deliberately **not** wired up yet:

- Firestore / Cloud Storage (missions and progress live in memory; a page
  reload resets them)
- Camera capture, geolocation geofencing, OCR verification (the capture screen
  is a simulated stub — see `src/stores/progress.ts`)
- The admin campaign builder and live dashboard
- Auth of any kind

Do not add these speculatively. Each has a marked seam; see
`docs/architecture.md` § "Seams left open".

## Development

- **Do not** run `vite build`, `npm run build`, `cap sync`, or any build commands
  unless explicitly asked.
- **Do not** prompt the user asking if they would like to run a build.
- The dev server (`npm run dev`) and the Firebase emulators (`npm run emulators`
  in `firebase/`) are managed by the user separately.
- Local dev never needs a real Firebase project — the emulators run offline
  under the `demo-app` project id.
- Use `npm` as the package manager (not yarn or pnpm).

## i18n rules (non-negotiable)

- No hardcoded user-facing strings in templates or stores — every string is a key
  in a per-feature module under `src/i18n/locales/`, resolved with `useI18n()`'s `t()`.
- `en` is the authored source of truth. `es` is typed `typeof en`, so adding a
  string means adding the key to **both** locales in the same change — a missing
  or extra key is a `tsc` error, not a runtime warning.
- Seed data and enums store i18n **keys**, never display strings.

## Animation rules (non-negotiable)

- Page-to-page animation goes through the View Transitions wrapper in
  `src/router/index.ts` — never call `document.startViewTransition` anywhere else.
- Hero transitions = matching `view-transition-name` on source and target,
  derived from the item id. Names must be unique per page — never a static name
  inside a `v-for`.
- Animate only `transform` and `opacity`. Durations 200–350ms.
- All transition CSS lives in `src/assets/css/transitions.css`, organized as
  numbered recipes.
- Every animation must degrade gracefully: reduced-motion and unsupported
  browsers get instant navigation.

## Dev tooling

`src/dev/` holds test affordances, not product. Today that is the quick-login
switcher: a floating panel that jumps the fan session between progress
personas (fresh / halfway / one away / winner / already claimed).

Rules for anything added there:

- It must be gated on `import.meta.env.DEV`, which Vite replaces with the
  literal `false` in a production build. Resolve the component through a
  `defineAsyncComponent(() => import(...))` **inside** that branch, so Rollup
  drops the import too — hidden is not the same as absent.
- Verify after any change: `npm run build && grep -r "Quick login" app/dist`
  must return nothing, and no dev chunk may appear in `dist/assets/`.
- **The i18n rule does not apply in `src/dev/`.** Strings there are never
  shown to a fan and never shipped, so translating them would add two locales
  of copy nobody can read. This is the only exemption; everywhere else the
  no-hardcoded-strings rule is absolute.
- Dev tooling may write store refs directly rather than going through actions.
  Keeping the affordance in `src/dev/` is better than adding a
  `applyDevState()` to product code that only dev tooling would call.

## White-label rules

This is a product template, not a one-team app. Team identity lives in exactly
two places:

- `src/config/tenant.ts` — the DEFAULTS a fresh install starts from
- `src/stores/tenant.ts` — the LIVE values, editable at `/admin/branding`
- `src/assets/css/main.css` — the `@theme` block the store overrides at runtime

Read `docs/branding.md` before adding a branded property. count

Never hardcode a team name, color, or logo path anywhere else.
