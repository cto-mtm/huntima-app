# Shell architecture — one chrome, two levels

> **STATUS: IMPLEMENTED** (2026-09-13). `AppShell.vue` renders both levels,
> deriving context from `route.params.tenantSlug`; `/home` (`HomePage.vue`)
> is the platform home; `/` is the signed-out hero only, with the router
> guard redirecting between them. `joinedHunts` on fan progress backs the
> "ongoing hunts" cards. The sections below are the design rationale, kept
> as written — with one decision since reversed: the organizer card is no
> longer on the platform home (see § "Home shows your games", item 2).

## The model

The app is ONE surface with TWO levels, like a mall and its stores:

```
PLATFORM level (Huntima brand)          BRAND level (org brand)
/home      — your hunts, ongoing games   /:slug           — hub (missions)
/trophies  — the global shelf            /:slug/missions/:id[/capture]
/profile   — identity, account           /:slug/redeem    — the prize
                                         /:slug/about     — how to play
        ⬑ enter a brand: shell re-skins ⬏
        ⬐ exit up: leading nav tab      ⬎
```

- **One `AppShell` renders both levels.** It derives its context from the
  route (`tenantSlug` param present → brand level) and swaps exactly two
  things: the header identity and the nav tab set. Same header bar, same
  bottom nav, same backdrop, same safe-area math — so moving between levels
  is a re-skin, never a different UI.
- **Theme changes ONLY at level boundaries.** Entering `/:slug` applies that
  org's brand (as today, synchronously from cache); exiting to platform
  level restores Huntima. Within a level, nothing ever flips. The old
  jarring case — the Trophies tab flipping colors mid-game — is gone
  because Trophies is not in the brand nav.
- **Navigation is hierarchical, not flat.**
  - Platform nav: **Home · Trophies · Profile**.
  - Brand nav: **Huntima (exit up) · Missions · Prize · About** — the
    leading tab wears the platform logo and returns to `/home`. The header
    shows the org's mark + name; the avatar (→ profile) stays top-right at
    both levels.
- **Platform promises live at platform level.** How photos are handled and
  what happens to a guest's badges are Huntima's commitments, identical at
  every venue — they sit on `/profile`, not on a brand's About page. They
  were on About, which made them unreachable to anyone who signed in without
  scanning a QR code, and implied the club was the one making them. A brand's
  About keeps only what is true of THAT hunt (how to play, where to claim,
  who runs it) and links across. About itself stays in the BRAND nav: moving
  it up would flip the theme mid-game, which is the same reason Trophies is
  not in the brand nav.
- **`/` is marketing only.** Signed out: the hero (logo, sign-in CTA, QR
  hint) — the one remaining bare consumer page, on purpose: it is a poster,
  not the app. Signed in, `/` redirects to `/home` (the router guard awaits
  auth restore when an account has been used on the device, which also
  kills the hero-flash-on-reload). `/home` redirects the signed-out to `/`.
- **Bare layouts remain only for out-of-app surfaces:** sign-in, staff
  login, tenant welcome, org picker, the admin console, 404.

## Home shows your games; a brand shows its hunt

Platform Home (`/home`) answers "what's going on for ME":

1. **Ongoing hunts** — brands this fan has joined, with earned-badge counts
   and a Continue button that enters the brand. Requires remembering WHICH
   brands were joined: a new `joinedHunts` record on fan progress
   (slug, teamName + badgeTarget snapshot, campaignId, joinedAt), written
   when the hub fires its `participant` event, merged union-by-slug across
   devices, optional in `fanProgressSchema` so old docs still parse.
2. **One link to the other hat** — "Run your own hunt", pointing at `/orgs`.
   This was an organizer CARD (the list of orgs you run, plus the create
   form) and it was wrong here. An account manages one org and plays in
   another, which is the platform's premise, so the player's home is not
   where you administer anything. It also misread for a platform operator,
   whose `/me/orgs` returns every org on the platform: the fan home was
   rendering a support console. The list and the form live at `/orgs`, and
   the account card on `/profile` links there too, so the organizer hat has
   a durable home on the identity surface rather than on the player's.
3. Discovery (Phase 3) slots in below without moving anything.

The brand hub keeps answering "what's going on HERE": the live hunt's
missions, progress meter, prize.

## Why this scales

- Phase 3 surfaces (discovery, accolades, public profiles) are all
  platform-level: they land in the platform nav/theme with zero new chrome.
- New brand-level surfaces (leaderboard, gallery/live screen from the data
  policy work) land in the brand nav the same way.
- The two-level metaphor matches the data model exactly: global consumer
  identity (`/me/*`) vs. tenant subtree (`tenants/{slug}/*`). Chrome,
  routes, theme and Firestore all draw the same line.

## Implementation steps

1. `shared`: add `home` to `RESERVED_SLUGS` (it is missing — an org could
   claim `/home` today); optional `joinedHunts` on `fanProgressSchema`.
2. Progress store: record/merge `joinedHunts` (union by slug, newest
   snapshot wins); HubPage writes it where the participant event fires.
3. Router: add `platform-home` (`/home`, in-shell); landing↔home redirects
   with auth-await; drop `meta.bare` assumptions accordingly.
4. AppShell: `context` computed from the route; two nav configs; header
   identity swap (Huntima logo + display mark ↔ TeamMark + team name);
   leading exit tab in brand context.
5. `HomePage.vue`: greeting and ongoing-hunts cards. (The organizer card
   this step added has since been removed — see item 2 above.)
6. LandingPage: signed-out hero only (revert the adaptive split).
7. Docs: fold the result into `architecture.md`/`branding.md`.

## Decisions taken (challenge before implementing if wrong)

- Trophies is platform-only; from inside a hunt it is two taps (exit up →
  Trophies). The trade for a never-flipping brand space.
- The brand-level exit is a leading NAV TAB (thumb-reachable), not a header
  chip.
- The signed-out `/` stays bare. A shell full of tabs that all bounce to
  sign-in is worse than a poster with one button.
