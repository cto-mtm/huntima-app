# White-labeling

This is a product template, not a one-team app. Re-skinning for a new club
should take minutes and touch no component code.

## The two seams

| Seam | File | What it controls |
|---|---|---|
| Defaults | [`app/src/config/tenant.ts`](../app/src/config/tenant.ts) | What a **fresh install** looks like |
| Live values | [`app/src/stores/tenant.ts`](../app/src/stores/tenant.ts) | What **you are looking at** right now |

Edit `config/tenant.ts` to change the shipped defaults. Use **`/admin/branding`**
to change the running app.

If you find yourself hardcoding a team name, venue, or color anywhere else,
that's a bug.

## How the re-skin actually works

There is no theme framework here. The whole mechanism is three steps:

1. The `@theme` block in [`main.css`](../app/src/assets/css/main.css) declares
   `--color-brand-*` and `--color-accent-*`.
2. Tailwind v4 compiles `bg-brand-600` down to
   `background-color: var(--color-brand-600)`.
3. The tenant store writes those custom properties onto `<html>` at runtime.

So overriding one custom property re-skins every utility in the app — no
rebuild, no reload, no parallel "theme" palette to keep in sync. The admin
preview renders the *real* components for exactly this reason: if the preview
looks right, the app looks right.

The store applies the theme synchronously during setup, before first paint. A
flash of the default palette on every load is the one thing a white-label
product cannot afford.

## The palette is derived, not hand-picked

The admin picks **one** brand color and **one** accent color.
[`lib/color.ts`](../app/src/lib/color.ts) derives the full 50→900 ramp from it:
hue and saturation come from the base color, lightness comes from a fixed
per-stop table, and saturation eases off at the extremes so the 50 doesn't read
as a tinted grey and the 900 doesn't go muddy.

Asking a marketing coordinator to hand-pick eight tints is how you get a palette
with no through-line. If you later need perceptual uniformity, swap the interior
of `generateRamp` for OKLCH — nothing else changes.

## Contrast is a feature, not a lint rule

The branding screen grades white-on-`brand-600` and white-on-`accent-600`
against WCAG. This app is used **outdoors, in daylight, on a phone held at arm's
length, by a child**. A brand color that fails contrast doesn't produce an ugly
button; it produces a button nobody can find.

The shipped default accent (`#d09a2c`) grades at 3.50:1 — "large text only".
That is deliberate: it's only ever used behind large badge numerals and the win
state, never body copy. If you put it behind small text, fix the color.

## Adding a new branded property

1. Add the field to `TenantConfig` and `DEFAULT_TENANT` in `config/tenant.ts`.
2. If it is a color, add the stop to the `@theme` block in `main.css` and to
   `BRAND_STOPS` / `ACCENT_STOPS` in `lib/color.ts` so it gets generated.
3. Add a control to `AdminBrandingPage.vue` and its label/help strings to
   **both** locales in `i18n/locales/pages/admin.ts`.
4. Read it via `useTenantStore().settings`, never by importing `config/tenant`.

`stores/tenant.ts` parses the cached config against `tenantConfigSchema` and
discards it wholesale if it no longer fits — a half-shaped brand renders as
broken images and wrong colors, which is worse than falling back to defaults
for the moment it takes the API to answer.

## Known limits

- **Branding is published, not auto-saved.** Edits preview locally and reach
  other devices only when you press Publish. Every keystroke reaching a
  stadium full of phones is not a feature.
- **`localStorage` is a cache, not the truth.** It exists so the first paint
  is already branded before the network answers, and so the app still looks
  like the club with no signal. The API is authoritative.
- **Multi-tenant.** One deployment serves every org: branding lives in
  `tenants/{slug}` (the URL slug is the document id), the store is scoped by
  the router guard (`activate(slug)` / `deactivate()`), and writes are gated
  on org membership — see `docs/platform-migration.md`.
- **No image cleanup.** Removing a logo or avatar drops the reference, not the
  object in Storage. Orphans accumulate; a lifecycle rule is the fix.
- **The venue geofence is still a constant** in `config/tenant.ts`. It needs a
  map picker in the admin tool before it can be tenant data.
