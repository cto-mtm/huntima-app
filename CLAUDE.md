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
  `docs/branding.md` before touching anything brand- or color-related,
  `docs/hunt-generation.md` for the LLM prompt that drafts a hunt's missions — the basis for a future "Generate missions" button)

## Current state

The fan-facing flow (hub → mission → capture → trophy case → redeem) and the
staff admin (branding, hunt builder, per-hunt analytics) are real routes and
components backed by the Cloud Functions `api` and Firestore. Running against
the Emulator Suite is the local dev workflow — it is the same code that
deploys, not a mock.

Wired up:

- **Firestore** — tenant branding, hunts/campaigns, and the published mission
  list (`GET /missions`, which returns an empty list when no hunt is
  published; the fan hub shows an empty state rather than seeded content).
  **Cloud Storage** holds team assets and mission target photos.
- **Auth** — Firebase Auth; the verified `admin` custom claim gates staff.
  Fans sign in with Google/email or play as a guest.
- **Capture verification** — a real photo (file input, `capture="environment"`)
  is posted to `POST /verify-capture` and judged server-side by Gemini. The
  image is never stored.
- **Per-hunt analytics** — aggregate participation/capture counters in
  Firestore, surfaced at `/admin/hunts/:id/stats`. Counters only — no
  per-person row, by design (see `docs/architecture.md`).

Still deliberately open (see `docs/architecture.md` § "Seams left open"):

- Native camera viewfinder, geofencing, and OCR "spyglass" verification
- Per-fan server-side progress: the badge ledger lives in `localStorage`
  (`src/stores/progress.ts`) and the claim code is derived, not issued — which
  is why analytics keeps aggregate counters rather than trusting a fan's count

Do not add the open seams speculatively. Each drags in a real decision
(PII retention, prize fraud) that belongs in its own change.

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

`src/dev/` holds test affordances, not product:

- `DevPersonaPicker.vue` — on the entry screen, signs in as a fan at a given
  progress state (fresh / halfway / one away / winner / already claimed)
- `DevAdminSeeder.vue` — on the staff login screen, creates the demo staff
  account in the Auth emulator, which starts empty

Rules for anything added there:

- It must be gated on `import.meta.env.DEV`, which Vite replaces with the
  literal `false` in a production build. Resolve the component through a
  `defineAsyncComponent(() => import(...))` **inside** that branch, so Rollup
  drops the import too — hidden is not the same as absent.
- Verify after any change: `npm run build && grep -r "Dev shortcut" app/dist`
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
