# Platform migration — Phase 1: Multi-tenancy

> **STATUS: IMPLEMENTED** (prelaunch big-bang, no backward compatibility, as
> decided). Deviations from the plan below: there are NO legacy route
> aliases, no `LEGACY_TENANT_SLUG`, and no production migration script
> (nothing deployed to migrate); `POST /t/:slug/admin/members` shipped in
> Phase 1 (an org's second staff account needed a door). Route split landed
> as planned after one detour: consumer identity (`/signin`, `/trophies`,
> `/profile`) is GLOBAL — a fan signs in from the landing page, no QR
> needed — while play (`hub/missions/capture/redeem/about/welcome`) is
> slug-scoped. The shell nav bridges the two via the last-visited org
> (`huntima:last-slug`), and tenant tabs carry their slug explicitly.
> **Phase 2's first slice also shipped early:** `POST /orgs` is flipped to
> any signed-in account (rate-limited 5/day/uid; operators exempt), and the
> global profile page carries "Your hunts" — a consumer creates their own
> org + console from a name and a slug. A platform avatar set (bundled
> SVGs, `platform:*` ids, `lib/avatars.ts`) gives fans a face on every
> org's page; org uploads join the picker inside their org.
> **The organizer funnel is now continuous end to end.** `/staff-login` was a
> staff-only gate that signed out any account with no org — the one link
> labelled for organizers was the one place you could not become one. It is
> now a front door (Google, sign-up, password reset), and an account with no
> orgs lands on `/orgs`, which carries the create form (`CreateOrgForm.vue`,
> shared with the consumer home) rather than a dead end. `GET
> /orgs/slug-available` answers the claim-your-URL question while the name is
> still being typed, and `slugRejection()` in `shared` separates "reserved"
> from "malformed" so the form stops blaming a reserved word on its length.
> **Starting a hunt no longer means founding an organization.** `POST
> /me/hunts` takes one field, the hunt's name, and puts a draft in this
> account's personal space — creating that space on the way through if it is
> their first. `tenants/{slug}._meta.kind` (`personal` | `org`) carries the
> distinction and is surfaced on `GET /me/orgs`; `POST /orgs` still exists for
> the deliberate case and is folded away at the bottom of `/orgs`. One entity,
> two vocabularies: everything a hunt needs (address, branding, storage,
> analytics, membership) already hangs off a tenant, so a second entity would
> have duplicated all of it to express what is a difference in how much setup
> to ask for.
> The console gained the two things it was missing: `/admin/members`, an
> owner-only Team page on the Phase 1 member API (plus `DELETE
> /t/:slug/admin/members/:uid`, which refuses the last owner in a
> transaction), and `PublicLinkCard.vue` — the org's public address, a copy
> button and a printable QR code, which no screen had ever shown.
> The rest of this document is kept as the design rationale.

The pivot: from a white-label single-club deployment to a platform where
`huntima.app/louisville-bats` is one brand page among many. This document is
the concrete plan for **Phase 1 only** — tenant-scoped data, routes, and
membership-based authorization. Self-serve organizer signup (Phase 2) and the
discovery/consumer layer (Phase 3) build on it but are deliberately out of
scope here; see "What Phase 2 needs from us" at the end.

Everything below is grounded in the current code. File references are to the
state at the time of writing.

---

## Design decisions (made here, argued briefly)

### D1. The slug IS the tenant id

`tenants/{slug}` with the URL slug as the Firestore document id
(`louisville-bats`), not a random id plus a slug-lookup collection.

- One document read resolves a fan's first paint — no slug→id indirection on
  the hottest path (a stadium of phones hitting `GET /t/:slug/tenant` at once).
- The cost is that renaming a slug is a document move. Accepted: renames are
  rare, organizer-initiated, and can ship later as a copy + redirect-stub
  (`tenants/{oldSlug} = { movedTo: newSlug }`). Devpost lives fine with sticky
  slugs.

Slug rules (enforced in `shared/`, single definition):

- `^[a-z0-9](?:-?[a-z0-9])+$`, 3–50 chars (lowercase alphanumerics and
  single interior hyphens).
- A **reserved list** that must contain every current and plausible top-level
  route: `admin`, `missions`, `trophies`, `redeem`, `about`, `welcome`,
  `signin`, `staff-login`, `profile`, `dev`, `api`, `t`, `orgs`, `me`,
  `health`, plus platform words we will want later (`explore`, `pricing`,
  `help`, `terms`, `privacy`, `app`, `www`). A fan URL and a route must never
  collide.

### D2. Campaigns become a subcollection: `tenants/{slug}/campaigns/{id}`

Not a top-level collection with a `tenantId` field.

- Security rules scope for free: `match /tenants/{t}/campaigns/{c}`.
- The "exactly one published hunt" transaction in
  `firebase/functions/src/helpers/campaigns.ts:77` keeps working with a
  single-field query (`where status == published` **within** the
  subcollection) — no composite index needed.
- Per-tenant delete/export stays a subtree operation.
- Phase 3 discovery ("all published hunts on the platform") will need one
  `collectionGroup('campaigns')` index. That is a cheap, later, additive cost.

Same shape for stats: `tenants/{slug}/campaign_stats/{campaignId}`.

**Campaign document ids are preserved during migration** (see M2). This is
load-bearing: fan progress — both localStorage and `fan_progress/{uid}` — keys
`earned`/`claimed` by campaignId. Because campaign ids are Firestore auto-ids,
they are globally unique, so progress needs no per-tenant partitioning at all.

### D3. Membership documents replace the global `admin` claim for org access

`tenants/{slug}/members/{uid}` → `{ uid, role: 'owner' | 'editor', addedAt, addedBy }`.

Why not per-tenant custom claims (`claims.tenants = {...}`):

- Claims are capped at 1000 bytes — a hard ceiling on orgs per user.
- Claims changes need a token refresh to take effect; membership docs revoke
  instantly.
- Membership docs are checkable from **both** the Functions API (one read in
  `requireMember`) and Firestore/Storage security rules (`exists()`), so the
  three enforcement points share one source of truth.

The `uid` is stored redundantly *as a field* so `GET /me/orgs` can be a
`collectionGroup('members').where('uid', '==', uid)` query (needs one
collection-group index, added in this phase).

Roles in Phase 1 are coarse: `owner` and `editor` both manage branding, hunts,
and stats; only `owner` manages members. Finer RBAC is not a Phase 1 problem.

**The existing global `admin` claim survives — redefined as platform
operator.** It bypasses membership everywhere (API and rules). That keeps
`grant-admin.mjs`, the emulator seeder, and your own access working unchanged,
and gives support/ops a story from day one. `requireStaff()` becomes
`requireMember(slug)` (member of that org, or platform operator).

### D4. Path-based tenant URLs, one Hosting site

`huntima.app/:slug/...` — not per-tenant subdomains.

- One Firebase Hosting deploy, one SPA, the existing `** → /index.html`
  rewrite already handles it (`firebase/firebase.json:9`).
- No wildcard DNS, no per-tenant SSL, no CORS allow-list explosion
  (`helpers/cors.ts` gains exactly one origin: `https://huntima.app`).
- It is the Devpost pattern, which is the stated design inspiration.

### D5. The API grows a tenant prefix: `/t/:slug/...`

Public fan routes and org-scoped admin routes move under `/t/:slug`. The `t`
segment keeps the router unambiguous (a bare `/:slug/missions` in the API
would collide with `/campaigns`, `/me`, future routes — the reserved-word
problem all over again, but server-side; one literal segment sidesteps it
forever). App-side URLs stay pretty (`huntima.app/louisville-bats`); the
`/t/` prefix is wire-format only.

Legacy unprefixed routes (`GET /tenant`, `GET /missions`, …) stay as aliases
to a configured legacy slug during the transition (see M4), then get deleted.

### D6. Fan identity does not change in Phase 1

Guests stay device-local; signed-in fans keep one global `fan_progress/{uid}`
document. Because campaign ids stay globally unique (D2), the only schema
touch is adding `tenantSlug` to `wonHuntSchema` so the trophy shelf can say
*which club* a trophy came from. The privacy posture (aggregate-only
analytics, no captures stored, no per-fan attribution) is untouched — that
re-decision belongs to Phase 3, deliberately.

---

## Target state

### Firestore

```
tenants/{slug}                      branding config + { createdAt, createdBy }
tenants/{slug}/members/{uid}        { uid, role, addedAt, addedBy }
tenants/{slug}/campaigns/{id}       hunt doc, missions embedded (unchanged shape)
tenants/{slug}/campaign_stats/{id}  aggregate counters (unchanged shape)
fan_progress/{uid}                  unchanged (global; campaign ids are unique)
rate_limits/{bucket:key}            unchanged (keyed by IP, deliberately global)
```

### Storage

```
tenants/{slug}/assets/{file}                     logo + avatars (shape already right —
                                                 only the hardcoded 'default' goes away)
tenants/{slug}/campaigns/{id}/targets/{file}     mission target photos (moves under tenant)
```

### API

| Route | Auth | Notes |
|---|---|---|
| `GET /health`, `POST /echo` | public | unchanged |
| `GET /t/:slug/tenant` | public | was `GET /tenant` |
| `GET /t/:slug/missions` | public | was `GET /missions`; published hunt **of that tenant** |
| `POST /t/:slug/verify-capture` | public, rate-limited | was `POST /verify-capture`; mission lookup scoped to the tenant — closes cross-tenant campaignId guessing |
| `POST /t/:slug/campaigns/:id/events` | public, rate-limited | was `POST /campaigns/:id/events` |
| `GET/PUT /me/progress` | any signed-in | unchanged |
| `GET /me/orgs` | any signed-in | NEW — memberships via collection-group query |
| `POST /orgs` | platform operator (Phase 1) | NEW — creates `tenants/{slug}` + owner membership; validates + reserves slug. Phase 2 flips the gate to any signed-in user |
| `PUT /t/:slug/admin/tenant` | member | was `PUT /admin/tenant` |
| `GET /t/:slug/admin/whoami` | member | returns role |
| `/t/:slug/admin/campaigns...` (full CRUD + missions + stats) | member | was `/admin/campaigns...` |
| `POST /dev/seed-admin` | emulator only | now also seeds a demo org + membership |

### App routes

```
/                          platform landing (Phase 1: minimal — logo + "find your team";
                           becomes discovery in Phase 3)
/welcome /signin /about    global, unchanged
/profile /trophies         global (fan identity is cross-tenant, D6)
/staff-login               global; on success → org picker
/orgs                      NEW org picker: memberships from GET /me/orgs
/:tenantSlug               fan hub for that tenant (today's `/`)
/:tenantSlug/missions/:id            mission detail
/:tenantSlug/missions/:id/capture    capture
/:tenantSlug/redeem                  redeem
/:tenantSlug/admin                   → redirect to hunts
/:tenantSlug/admin/hunts[...]        hunt list / editor / stats
/:tenantSlug/admin/branding          branding
/:pathMatch(.*)*           404 (also serves unknown-slug, see S3)
```

`/trophies` stays global — the shelf shows every club's trophies (that is the
point of a platform trophy case). `/redeem` moves under the tenant: a prize is
redeemed *at a venue*.

---

## Implementation steps

Each step is a coherent, individually shippable PR. Order matters: contracts →
server → rules → app → admin UX → migration/seed.

### S0 — `shared/`: the tenant contract

`shared/src/schemas.ts` + re-exports in `shared/src/index.ts`:

- `tenantSlugSchema` — the regex, length bounds, and `RESERVED_SLUGS` set from
  D1. One definition; the API, the router guard, and the future signup form
  all import it.
- `orgRoleSchema = z.enum(['owner', 'editor'])`; `memberSchema`.
- `orgSummarySchema` (`{ slug, teamName, role }`) and the `GET /me/orgs`
  response schema.
- `wonHuntSchema` gains `tenantSlug: tenantSlugSchema.optional()` (optional so
  every stored trophy still parses; see M3).
- `tenantConfigSchema` itself stays **pure branding** — slug/created-by live
  beside it in the doc, written by the server, never client-writable. This
  keeps `PUT /t/:slug/admin/tenant` a whole-document branding replace exactly
  as today (`api.ts:287`), with no risk of an org renaming itself through the
  branding form.
- `SEED_TENANT` stays as the branding default a new org starts from (its
  Louisville Bats values become just seed/demo content — see S6).

### S1 — Functions: tenant-scoped helpers + routes

- `helpers/tenant.ts` — `getTenant(slug)`, `putTenant(slug, config)`,
  `createOrg(slug, config, ownerUid)` — a create-if-absent transaction, so
  two simultaneous claims of one slug resolve to exactly one winner (matters
  the day Phase 2 opens creation to the public). The `tenants/default` constant
  (`tenant.ts:12`) is deleted. `getTenant` of an unknown slug returns `null`
  → the API answers **404**, not the seed fallback: on a platform, a mistyped
  slug must not render a phantom Louisville Bats page. (The
  fresh-install-renders-something behavior moves to the seeded demo org, S6.)
- `helpers/campaigns.ts` — every function gains a leading `slug` parameter;
  `COLLECTION` becomes `collection(`tenants/${slug}/campaigns`)`. The publish
  transaction and `getPublishedMissionList` (`campaigns.ts:77,130`) keep their
  exact logic, now naturally scoped. `findMission(slug, campaignId, missionId)`
  can no longer cross tenants.
- `helpers/analytics.ts` — same treatment
  (`tenants/{slug}/campaign_stats/{campaignId}`).
- `helpers/auth.ts` — `verifyRequest` unchanged; `isAdmin` renamed in meaning
  to *platform operator*. New `helpers/members.ts`: `getMembership(slug, uid)`,
  `listOrgs(uid)` (collection-group query), `addMember`, and the
  `requireMember(slug)` gate = membership exists **or** platform operator.
- `api.ts` — routing: `segments[0] === 't'` → resolve `slug = segments[1]`
  (validate with `tenantSlugSchema` before any Firestore read), dispatch the
  scoped routes; legacy unprefixed routes alias to `LEGACY_TENANT_SLUG`
  (env-configured, M4). `VALID_ROUTES` updated. `/dev/seed-admin` also writes
  the demo org + owner membership.
- Rate limiting: `verify-capture` keeps its per-IP gate and **adds a
  per-tenant daily budget bucket** (`bucket: 'verify-capture:tenant', key:
  slug`, generous default). Today one club's traffic is the whole bill; on a
  platform, one org's viral hunt must not be able to drive unbounded Gemini
  spend for everyone. The knob also becomes the natural seam for Phase 2
  billing tiers.
- Firestore indexes: add the `members` collection-group index on `uid` to
  `firebase/firestore.indexes.json` (currently empty).

### S2 — Security rules: membership checks

- `firebase/firestore.rules` — replace bare `isStaff()` with, per subtree:

  ```
  function isOperator() { return request.auth.token.admin == true; }
  function isMember(t) {
    return request.auth != null &&
      exists(/databases/$(database)/documents/tenants/$(t)/members/$(request.auth.uid));
  }
  match /tenants/{t} {
    allow read: if true;                       // branding is public
    allow write: if isOperator();              // orgs are created via the API
    match /members/{uid}  { allow read: if isMember(t) || isOperator();
                            allow write: if isOperator(); }   // Phase 1: API-only writes
    match /campaigns/{c}  { allow read: if true;
                            allow write: if isMember(t) || isOperator(); }
    match /campaign_stats/{c} { allow read: if isMember(t) || isOperator();
                                allow write: if false; }      // functions (admin SDK) only
  }
  ```

  (Advisory today — all writes flow through the Functions API, which uses the
  Admin SDK and bypasses rules — but Phase 2's self-serve UI may talk to
  Firestore directly, and rules written now are the cheap insurance.)
- `firebase/storage.rules` — scope writes by membership using the
  cross-service `firestore.exists()` (Rules v2 supports it):

  ```
  match /tenants/{t}/assets/{file} { allow write: if isMemberOf(t); }
  match /tenants/{t}/campaigns/{c}/targets/{file} { allow write: if isMemberOf(t); }
  ```

  Keep the existing world-read and the hard deny on fan-capture paths.
  The old `campaigns/{id}/targets` match stays **read-only** until M2 cleanup.

### S3 — App: slug resolution + scoped fan routes

- **Router** (`app/src/router/index.ts`) — fan + admin routes nest under
  `/:tenantSlug` per the table above. A `beforeEach` addition: on entering any
  tenant-scoped route, validate the slug shape (reject → 404 route) and call
  `tenantStore.load(slug)`; a 404 from the API renders the not-found page
  ("no team here yet"), which in Phase 2 becomes the "claim this name" hook.
  The view-transition wrapper (`beforeResolve`/`afterEach`) is untouched.
- **Tenant store** (`app/src/stores/tenant.ts`) — `load(slug)`; cache key
  becomes `huntima:tenant:${slug}` (was the global `huntima:tenant`,
  `tenant.ts:10`). First-paint behavior preserved: apply cached brand for the
  *current URL's slug* synchronously, reconcile from the API after.
- **Missions store** — `load(slug)` → `GET /t/:slug/missions`; capture posts
  to `/t/:slug/verify-capture`; analytics events to
  `/t/:slug/campaigns/:id/events`. `lib/analytics.ts` dedup keys are fine
  as-is (campaignId is unique).
- **Progress store** (`app/src/stores/progress.ts`) — stays global
  (`huntima:progress`); stamps `tenantSlug` on new `wonHunts` entries.
- **App bootstrap** (`app/src/App.vue:34`) — no longer loads tenant/missions
  unconditionally; loading is driven by route entry (a fan on `/trophies` or
  the landing page has no tenant).
- **Uploads** — `TenantImagesField.vue:17` drops `TENANT_ID = 'default'` and
  takes the slug from the route/store; `MissionTargetField.vue` and
  `lib/storage.ts:98` build the new tenant-prefixed target path.
- **Legacy QR redirects** — root-level `/missions/:id` etc. redirect to
  `/${LEGACY_TENANT_SLUG}/...` (same env value as the API alias, M4) so
  jumbotron QR codes printed before the pivot keep working. One route entry,
  deleted when the alias goes.
- **Entry + sign-in return paths** — the session gate bounces a fresh fan to
  `/welcome`, which is now *global*, but the fan arrived on `/:slug` from a
  QR code. The gate must carry the origin (`/welcome?to=/louisville-bats`)
  and the entry/sign-in pages must return there — a fan who scanned at the
  ballpark must never complete entry and land on the platform homepage.
  Same for `/staff-login` deep-linked from a tenant admin URL.
- **Theme lifecycle across tenant and global routes** — today the tenant
  store themes `<html>` once, globally. With slugs, `/trophies` or `/` after
  visiting a club would keep wearing that club's colors. The store gains an
  explicit platform-default theme; route entry applies the tenant theme,
  leaving a tenant scope restores the default. The synchronous
  first-paint-from-cache behavior is preserved *per slug* — and the admin
  branding preview keeps working unchanged since it lives under the slug.
- **i18n** — new strings (org picker, tenant-404, landing) added to **both**
  locales, per the non-negotiable rule.

### S4 — Admin: the org picker

- `/staff-login` success → `GET /me/orgs`: one org → straight to
  `/:slug/admin/hunts`; several → `/orgs` picker; zero → a "no organization
  yet" screen (Phase 2 turns this into "create one").
- Admin pages read the slug from the route and pass it through the existing
  api helpers — the pages themselves (hunt list, editor, stats, branding) need
  no structural change, only their fetch paths.
- `DevAdminSeeder.vue` keeps working: `/dev/seed-admin` now returns the demo
  org slug too, and the seeder can deep-link into it.
- **The session role model loosens.** `stores/session.ts` stores a single
  exclusive role (`huntima:role`: fan *or* admin), but the platform's
  premise is that one account can be both — an organizer should be able to
  play their own (or another club's) hunt. Phase 1 scope: stop treating the
  roles as mutually exclusive — derive "can play" and "is member of {slug}"
  independently from the same account instead of from one stored role value.
  The full "switch hats" UX (profile menu: my orgs / my trophies) can land
  with the org picker.

### S5 — Scripts: migration, seeding, member management

- `firebase/scripts/migrate-to-tenants.mjs` — the one-time production
  migration (M1–M3 below).
- `firebase/seed.mjs` — seeds **two** orgs (Louisville Bats + a second
  fictional club, distinct branding) so multi-tenancy is *visibly* exercised
  in every local session: two brand pages, two published hunts, isolation
  provable by eye.
- `grant-admin.mjs` — unchanged in function, re-documented as the *platform
  operator* grant. New sibling `grant-member.mjs <slug> <email> [role]`
  writing the membership doc.

### S6 — Perimeter: CORS, hosting, config

- `helpers/cors.ts` — add `https://huntima.app` (and any staging origin).
  Capacitor origins stay. (Remember: the emulator does not enforce the list —
  verify on a deployed function, per the comment in `cors.ts`.)
- `firebase.json` — unchanged (the SPA rewrite already covers slug paths).
- `capacitor.config.ts` — **explicitly deferred**: one platform app
  (`com.mtm.huntima`) is Phase 1's answer; per-club native shells or deep
  links (`huntima.app/louisville-bats` → app) are a separate decision, noted
  in `docs/architecture.md` as a new open seam.

---

## Data migration (existing deployment)

Runs once against production via `migrate-to-tenants.mjs <slug>` (e.g.
`louisville-bats`), Admin SDK, idempotent (safe to re-run):

- **M1. Tenant** — read `tenants/default`; write `tenants/{slug}` with the
  same branding plus `{ createdAt, createdBy: 'migration' }`. Write the
  membership doc for each existing admin account. Leave `tenants/default` in
  place until cutover is verified, then delete.
- **M2. Campaigns + stats** — copy every `campaigns/{id}` →
  `tenants/{slug}/campaigns/{id}` and `campaign_stats/{id}` →
  `tenants/{slug}/campaign_stats/{id}` **preserving document ids** (this is
  what keeps every fan's earned badges and trophies valid, D2). Storage
  objects are *not* moved: `targetImageUrl` and `logoUrl`/avatar URLs are
  absolute and remain world-readable at their old paths, so nothing a fan sees
  breaks. New uploads land on the new paths; the old `campaigns/*/targets`
  tree is frozen read-only (S2) and cleaned up whenever convenient.
- **M3. Fan progress** — untouched. Old `wonHunts` entries simply lack
  `tenantSlug` (hence optional in S0); the trophy shelf shows them without a
  club chip. No fan loses anything; nothing needs a backfill.
- **M4. Cutover** — deploy functions with `LEGACY_TENANT_SLUG=<slug>`: old
  app builds and printed QR codes keep resolving through the unprefixed
  aliases while the new app rolls out. After the next event day confirms
  traffic on the new paths, delete the aliases, the legacy redirects (S3), and
  `tenants/default`.

Rollback story: until M4's final deletion, the old document tree and old
routes still exist — rolling back is redeploying the previous function +
hosting build. The migration script only ever copies; it never mutates the
source tree.

## Verification (emulator-first, per the dev workflow)

- Seeded two-org state: `/{org-a}` and `/{org-b}` show different brands and
  different published hunts in the same browser; localStorage holds both
  tenant caches under distinct keys.
- Isolation: org A's member token on `PUT /t/org-b/admin/tenant` → 403;
  `GET /t/org-a/missions` never serves org B's published hunt;
  `POST /t/org-a/verify-capture` with org B's campaignId → 404.
- Continuity: a fan with pre-migration localStorage progress sees their badges
  intact on the migrated slug; legacy `/missions/:id` URL redirects into the
  slugged route.
- Flows: a fresh device deep-linking `/{org-a}/missions/{id}` gets bounced to
  entry and returns to that exact URL after choosing guest; navigating
  `/{org-a}` → `/trophies` drops org A's colors for the platform theme, and
  going back re-applies them without a flash of default.
- Operator: the `admin`-claim account passes every org gate; a plain account
  with no membership fails them all.
- Contract: `tsc` across `shared/`, `app/`, `functions/` — locale
  completeness and schema drift are compile errors by design.

---

## Beyond Phase 1 — the roadmap these decisions serve

Two platform features shape Phases 2–3, and both press directly on the app's
strongest current stance (captures never stored, no per-person rows, aggregate
analytics only). The resolution is to turn that single global stance into a
**per-hunt data policy chosen by the organizer inside platform guardrails** —
a stadium and a wedding genuinely want opposite things, and both are right.

### The platform guardrails (invariant across all phases)

1. **Per-person data requires an account plus explicit consent.** A guest —
   no account — never produces a stored photo or a roster row, only aggregate
   counters, no matter what the organizer configured. The account is the
   consent anchor: it is what makes "delete my data" and "show me my history"
   answerable. This is also the COPPA line — the kid-facing stadium mode works
   exactly as today, guest-first and anonymous.
2. **The most private setting is the default.** A new hunt starts in
   discard-photos / aggregate-analytics mode; an organizer opts *in* to
   retention or rosters per hunt, and the fan is told on the join screen and
   at capture time what happens to their photo before they take it.
3. **The organizer is the data controller for what they opt into.** Retained
   photos and rosters belong to the hunt's org; the platform provides the
   consent UX, the participant's self-serve deletion, and org-side export —
   the Devpost/Eventbrite model.

### Phase 2 — self-serve orgs + per-hunt data policy

- **Self-serve org creation** = flipping the `POST /orgs` gate from platform
  operator to any signed-in user, plus a signup UI on the tenant-404 / "no
  organization yet" screens. Slug validation, reservation, membership, and the
  org console all exist after Phase 1.
- **Data policy on the campaign** (`shared/`): a `dataPolicySchema` with two
  independent axes —

  ```
  photos:       'discard' | 'organizer' | 'gallery'
  participants: 'aggregate' | 'roster'
  ```

  `discard`/`aggregate` is today's behavior and the default (guardrail 2).
  `organizer` stores each **matched** capture to
  `tenants/{slug}/campaigns/{id}/captures/{uid}/{missionId}.jpg`, visible in
  the org console; `gallery` additionally makes the set visible to the hunt's
  participants — the wedding album. `roster` writes a participation row
  (nickname, joined-at, completion) per signed-in, consenting fan — the
  stadium's "clean list of participants" without keeping a single photo.
- **Consequences the policy drags in (why this is Phase 2, not a checkbox):**
  storage.rules gain a captures path whose read scope depends on the policy;
  `verify-capture` becomes optionally authenticated so a stored photo is
  attributed to the uid that consented; a participant needs a "my data in
  this hunt" view with delete; the org console needs gallery/roster tabs and
  export. Storing only *matched* captures is the deliberate MVP line — the
  gallery is the hunt's result, not a camera roll; widening to all attempts
  is a later organizer option if asked for.
- **Terminology neutralization** rides along: `teamName`/`prizeLocation` read
  stadium-shaped; a wedding org wants "event name" / "where to collect".
  Copy is already i18n keys, so this is relabeling plus (at most) schema
  aliases — but it is the moment to sweep for stadium-isms in fan-facing text.
- **Org offboarding** — self-serve creation implies deletion: a recursive
  subtree delete (tenant, members, campaigns, stats), storage cleanup under
  `tenants/{slug}/`, and a tombstone so the slug isn't instantly
  re-claimable by a squatter. Fan progress referencing the dead campaigns
  stays valid (trophies outlive the club, like any platform).
- **Brand pages need real link previews** — one SPA means every
  `huntima.app/:slug` shares one `index.html`: no per-club title, OG image,
  or social card. Fine for QR entry (Phase 1), not fine for organizers
  sharing their page (Phase 2's promise). Fix when it matters: a Hosting
  rewrite through a small function that injects per-tenant meta tags into
  `index.html` for `/:slug` requests — no SSR framework, the SPA stays a SPA.

### Phase 3 — consumer identity: history, profiles, accolades

- **Participation history** ("hunts I've played") and **platform accolades**
  (cross-hunt achievements: first hunt finished, five hunts, three venues,
  fifty verified captures…) both require events the server *witnessed*, not
  self-reported progress — an accolade minted from a client claim is worthless
  the day two orgs compete on it. So Phase 3 is gated on closing the
  **server-authoritative seam**: `verify-capture` (authed) appends to a
  server-owned ledger `users/{uid}/captures`, badges and hunt completions
  derive from it, claim codes get minted and invalidated server-side. This
  was already the "next thing to build" in `docs/architecture.md`; the
  platform makes it mandatory before strangers run prize campaigns at scale.
- **Accolade definitions are platform content, not tenant content** — defined
  once in `shared/` (id, i18n key, predicate over the ledger), evaluated
  server-side on capture/completion events, stored as `users/{uid}/accolades`.
  Tenants keep their own prizes; the platform owns the meta-game. That
  separation is exactly Devpost's: hackathon prizes are the organizer's,
  portfolio and badges are the platform's.
- **Guests never earn accolades** (guardrail 1) — the entry screen's sign-in
  pitch finally has a real answer to "why make an account": your history,
  your trophy shelf, your accolades, on any device. Public profile pages
  (`/u/:handle`) are the last step, and optional.
- Phase 1 needs **no changes** to serve any of this: the global
  `fan_progress`/`/me` surface, unique campaign ids, and the tenant tree are
  the right substrate. The one thing to *avoid* until the ledger exists:
  never surface self-reported progress as if it were platform-verified.

### Positioning vs. gallery-collector apps (e.g., Gathershot)

The adjacent category — QR-entry photo games for weddings/parties/corporate
events whose end product is a **shared photo album** — validates the event
verticals and several mechanics, but the products are inverted: for them the
photos *are* the product and the prompts are a device to fill the album; for
us the **verified game** is the product and stored photos are one opt-in data
policy among several. What that category proves out and we should salvage:

- **Vertical prompt templates** — wedding prompts, corporate icebreakers,
  campus orientation packs. Maps directly onto `docs/hunt-generation.md`: the
  LLM hunt drafter parameterized by vertical is our version, and better.
- **A live display surface per hunt** — the reception-screen slideshow is the
  wedding's jumbotron. A read-only `/:slug/live` page (latest gallery
  captures, or leaderboard/progress in stadium mode where photos are
  discarded) reuses the `gallery` policy and gives every vertical its big
  screen. Phase 2 candidate, cheap after data policy exists.
- **Per-event pricing for one-off organizers** (a wedding buys one hunt) next
  to subscription for brands running recurring campaigns — see
  `docs/business-plan.md` for the tier model and how its enforcement maps
  onto the seams this plan leaves (plan on the tenant doc, per-tenant
  verify-capture budget as the metering point).
- **Time-boxed hunts** (start/end window on a campaign) — table stakes in the
  event category, useful for stadiums too (game-day windows).

What they structurally cannot follow us into — the moat, and the reason the
gamification/competition/brand-engagement framing wins for B2B:

- **Verified captures** (Gemini judges the photo server-side) — their game is
  honor-system upload; ours can back prizes, leaderboards, and accolades
  because a capture is *earned*. Everything competitive hangs off this.
- **Competition surfaces** — per-hunt leaderboards and team play. NOTE:
  a leaderboard is per-person display, so it rides the same consent rail as
  rosters (guardrail 1: account + consent; guests play unranked). Phase 3,
  after the server ledger, or it's a leaderboard of self-reported claims.
- **Recurring brand engagement** — season passes, multi-event accolades,
  cross-hunt analytics. A wedding happens once; a ballclub has 70 home games.
  Retention mechanics, not albums, are what a brand pays for annually.
