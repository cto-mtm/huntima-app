# BUSINESS_MODEL.md — Huntima

**Drafted 2026-09-13.** Figures marked **verified** come from this repo (code,
docs, pinned model ids) as of this date. Every number marked `~` is an
estimate from provider price sheets as remembered at drafting time (the
session that produced this had no web access) — **re-verify each in the
provider's live pricing calculator before building billing against it.**
Nothing in this document is implemented: the repo has **no billing code, no
Stripe integration, no plan/entitlement fields** (verified — the only
payment-adjacent concept is a per-IP rate limiter in
`firebase/functions/src/helpers/rateLimit.ts`). This doc is the spec that
`docs/platform-migration.md` Phase 2 builds against.

---

## 1. The Model

**Type: B2B2C SaaS with a consumer one-off tier.** Organizers pay; players
never do. The product is verified photo hunts — captures judged server-side
by a vision model (`gemini-3.6-flash`, pinned in
`firebase/functions/src/helpers/vision.ts:31`, verified), so completions,
prizes and (later) leaderboards are *earned*, which is the moat over
album-collector competitors (Gathershot et al.; see
`docs/platform-migration.md` § Positioning).

**Pricing unit, one sentence:** *an organizer pays for the number of players
a hunt can admit; everything else (hunts, admin seats, missions) is
unlimited on paid tiers.*

**Who pays and who doesn't:**

- **Pays — the organizer** (tenant org in `tenants/{slug}`): venues, brands,
  companies, wedding hosts. They get the brand page, the hunt builder, the
  analytics, and the data policy controls.
- **Never pays — the player.** Fans are anonymous-by-default
  (`docs/architecture.md` § Identity, verified) and many are minors at a
  public venue. A fan-side paywall was **rejected as an architecture
  violation**, not just a growth tactic: fan payment requires fan billing
  identity, which contradicts the no-PII-on-minors posture the entire
  capture pipeline is built around (photos never stored, aggregate-only
  analytics — verified in `storage.rules` and `helpers/analytics.ts`).

**Archetypes, worked:**

- **Venue** — a minor-league ballclub, ~5,000 players on a game day, ~70
  home dates/season. Buys season engagement: annual platform fee +
  per-event-day blocks. At `~$0.001`/verification (see §6), their game day
  costs us `~$40–110` and is priced in the hundreds — the margin funds
  everything else.
- **Business** — a company running a 12-person team-building hunt
  quarterly, or a campus orientation. Subscribes monthly; usage cost to us
  is pennies; price is set by value (branded page + roster export), not
  cost.
- **Person** — a wedding host, ~100 guests, wants the photo album
  (`gallery` data policy, `docs/platform-migration.md` § Phase 2). Buys one
  Event, one time. This tier is the growth loop: every guest at every
  wedding sees the product working.
- **Free** — anyone kicking the tires: 1 active hunt, 10 players. Below the
  12-person corporate team **on purpose** — an offsite is a paying
  customer; a family game night is the funnel.

## 2. Pricing

**The metered dimension is `playersPerHunt`** — unique players admitted to a
single hunt, counted from the existing `participant` event
(`POST /t/:slug/campaigns/:id/events`, `helpers/analytics.ts`, verified:
client fires it once per device per hunt). Why this metric and not naïve
alternatives: it is simultaneously the organizer's own mental unit
(headcount), our near-only marginal cost driver (verifications ≈ players ×
missions × attempts, §6), and countable **without storing per-person rows**
— a per-fan meter would demand identified fans, which the data model
forbids by design. Per-seat and per-hunt pricing were rejected: admin
memberships and hunt counts cost us ~nothing and capping them just makes
the product worse.

| Plan | playersPerHunt | Who it really is | Monthly | Annual |
|---|---|---|---|---|
| **Free** | 10 | tire-kickers, families, the funnel | $0 | $0 |
| **Event** | 100 (+ player packs) | weddings, parties, reunions | — | `~$79` one-time |
| **Business** | 250 | companies, campuses, retail | `~$149` | `~$1,490` (2 mo free) |
| **Venue** | unlimited (5k+/event day) | stadiums, franchises | — | custom: `~$5–15k`/season + `~$300–600`/event day |

All four amounts are **adjustable constants** — they live in one place,
`shared/src/plans.ts` (`PLAN_LIMITS`, to be created in Phase 2, §5), and in
Stripe Price objects; nowhere else.

**Bracket rationale:** Free < 12 (the corporate team) so business use can't
ride free. Event = 100 covers the median wedding (~80–120 guests) in one
SKU. Business = 250 covers any single corporate/campus cohort; a brand that
regularly exceeds it is a Venue conversation. Venue is contract-priced
because one 5k-player event day consumes ~40× a Business tenant's monthly
usage and comes with event-day support expectations.

**Calibration honesty:** every dollar figure above rests on arithmetic
(cost floor × category-typical multiples) plus exactly one real datapoint
(the Louisville Bats relationship, no contract signed as of drafting —
verified: repo shows a seeded demo, not a customer). GooseChase/Scavify/
Gathershot comps were recalled from memory, not checked. **Instrument to
correct:** log per-campaign verification counts (already logged in
`api.ts` — `capture verified` entries) into a BigQuery export from day one
of Phase 1 production; after one real season, re-derive Venue pricing from
observed attempts-per-player instead of the 1.5 guess. Re-check comp
pricing pages before publishing a pricing page.

## 3. Freemium & gating mechanics

- **What is gated: organizer writes, never player reads.** Gates fire on
  hunt *publish* (player cap, data policy features) and on org-console
  features (analytics depth, roster export). A published hunt is **never
  degraded mid-event** — guest #101 at a wedding gets in; the organizer
  gets an upgrade prompt and (on paid tiers) an after-the-fact player pack
  charge. A hunt failing during someone's wedding toast is a churned
  customer and a public reputation event.
- **When conversion happens: at publish-time of a real event, not at
  signup.** A free org can build and run a full 10-player hunt — verified
  captures, badges, the whole product — because the habit-forming moment is
  *running one*. The wall appears exactly when they plan an event bigger
  than the free cap or want the gallery/roster. Day-one walls were
  rejected; an organizer who has never run a hunt has nothing to upgrade
  for.
- **Feature gates by tier:** photo retention (`gallery`/`organizer` data
  policies) and rosters are **paid-only, including on Event**. On Free they
  are absent not as upsell stinginess but as a legal stance: retention
  makes the org a data controller (`docs/platform-migration.md`
  § guardrails), and we only want that obligation held by paying,
  terms-accepting customers.
- **Hard rules (ethical floor, non-negotiable):** a lapsed org drops to
  **read-only + free export** — galleries and rosters exportable for 90
  days, never held hostage for reactivation. Players keep their trophies
  and progress forever regardless of any org's billing state (fan progress
  is the fan's, keyed by their uid — verified `helpers/fanProgress.ts`).
  Downgrades apply at period end, never mid-event.

⚠️ **Decision point:** does a lapsed org's *published* hunt stay playable
(read-only console but live fan page) or unpublish at period end? Live-page
tolerance costs us pennies and is better PR; confirm before building the
dunning flow.

## 4. Payment rails

| Rail | Used by | Fees (est.) | Notes |
|---|---|---|---|
| Stripe Checkout, card, one-time | Event | `~2.9% + $0.30` | The whole consumer rail. |
| Stripe Billing, card subscription | Business | `~2.9% + $0.30` + `~0.5%` Billing | Monthly/annual, customer portal for self-serve up/downgrade. |
| Stripe Invoicing + ACH | Venue | `~0.8% capped ~$5` (ACH) / `~0.4–0.5%` invoicing | Annual + event-day blocks; net-30 is normal for clubs. |
| Manual invoice (wire/check) | Venue fallback | ~$0 + labor | Some club back offices simply mail checks. Accept it. |
| Comp / sponsored | pilots, nonprofits, support | $0 | See below. |

**Sponsored rail principle:** when someone other than the organizer pays
(a league sponsoring its clubs, a brand sponsoring a campus hunt), the
sponsor gets an invoice; the org gets a plan override. Governing rule: **the
entitlement axis and the payment axis are separate** — `billing.plan` on
the tenant doc is what gates features, and *who paid* is a Stripe-side
fact. This is also how comps work: a platform operator (existing `admin`
claim, verified `helpers/auth.ts:43`) sets the override; no fake Stripe
objects.

⚠️ **Decision point (corporate/geographic):** Stripe onboarding needs the
MTM legal entity, tax setup (US sales tax on SaaS varies by state — Event
buyers are consumers in many states), and a decision on Stripe Tax
(`~0.5%`/transaction). None of this is knowable from the repo — confirm
entity status before any billing code is written.

## 5. Billing architecture (build spec)

Pricing must run through the same spine as everything else: zod contracts
in `shared/`, enforcement in the function, rules as backstop. Zero
scattered checks.

**Data model** — extend the tenant doc (never a new top-level collection;
tenancy boundary stays `tenants/{slug}`, per `docs/platform-migration.md`
D2/D3):

```
tenants/{slug}.billing = {
  plan: 'free' | 'event' | 'business' | 'venue',   // default 'free'
  stripeCustomerId: string | null,
  subscriptionId: string | null,
  status: 'active' | 'past_due' | 'lapsed',
  currentPeriodEnd: epoch-ms | null,
  playerPacks: number,          // purchased overage, additive to plan cap
  override: 'operator' | null,  // comp/sponsor axis, audit-logged
}
stripe_events/{eventId} = { processedAt }   // webhook idempotency ledger
```

`billing` is **server-written only** — same rule as the slug: it never
appears in `tenantConfigSchema`, so `PUT /t/:slug/admin/tenant` (the
branding form) can never touch it, and Firestore rules deny client writes
to it wholesale.

**The single limits table** — `shared/src/plans.ts` (new):

```ts
export const PLAN_LIMITS = {
  free:     { playersPerHunt: 10,   activeHunts: 1,  photoPolicies: ['discard'],           roster: false, verifyPerDay: 1_000 },
  event:    { playersPerHunt: 100,  activeHunts: 1,  photoPolicies: ['discard','gallery'], roster: true,  verifyPerDay: 5_000 },
  business: { playersPerHunt: 250,  activeHunts: -1, photoPolicies: 'all',                 roster: true,  verifyPerDay: 20_000 },
  venue:    { playersPerHunt: -1,   activeHunts: -1, photoPolicies: 'all',                 roster: true,  verifyPerDay: 200_000 },
} as const
```

One table, imported by **both** sides: the function enforces it, the app
reads it to render upgrade prompts and disabled controls (UI is courtesy;
the function is the gate — the exact pattern the admin routes already use,
verified `api.ts:99-114`).

**Entitlement middleware** — `functions/src/helpers/entitlements.ts`:
`requirePlan(slug, capability)` sits beside `requireMember(slug)` in the
route handlers; it reads `billing.plan` (+ `override`, + `playerPacks`) and
answers from `PLAN_LIMITS`. The per-tenant verify-capture budget bucket
(migration plan S1) takes its size from `PLAN_LIMITS[plan].verifyPerDay` —
the existing rate limiter (`helpers/rateLimit.ts`) becomes the usage
meter's teeth with zero new machinery.

**Webhooks** — a **separate** `onRequest` function `stripeWebhook`, not a
route on `api`: it must live outside the CORS allow-list and outside
bearer-token auth (Stripe doesn't send either), and its only auth is
signature verification against the webhook secret. Idempotent via
create-if-absent on `stripe_events/{eventId}` in a transaction (same
pattern as `createOrg`'s slug claim). Handles
`checkout.session.completed`, `customer.subscription.updated|deleted`,
`invoice.payment_failed` → writes only the `billing` object.

**Platform-admin axis** — the operator claim (existing `admin` claim,
redefined as platform operator in migration D3) can set
`billing.override`; every override write is logged with the operator uid.
This is the comp/sponsor/support lever and the break-glass for webhook
outages.

**Rejected for architectural reasons:** metered per-verification billing
(would incentivize storing per-fan usage rows and make the bill spiky and
illegible to a wedding host); client-checked entitlements (same reason the
router's admin guard is "convenience, not security" — verified comment,
`app/src/router/index.ts:89-91`); billing state in custom claims (1000-byte
cap, token-refresh lag — same reasons membership docs beat claims in
migration D3).

## 6. Infrastructure cost model

Stack (verified from repo): Firebase Hosting + one Cloud Functions v2
function (512 MiB, `us-central1`, `api.ts:78-86`) + Firestore + Cloud
Storage + Firebase Auth (no SMS) + Gemini API (`gemini-3.6-flash`).

Marginal cost **per player per hunt** (the unit pricing is sold in):

| Component | Driver | Est. unit price | Per player (5 missions, ~1.5 attempts) |
|---|---|---|---|
| Gemini verification | ~7.5 calls × (~1.3k img + ~0.5k prompt tokens in, ~0.1k out) | `~$0.30`/M in, `~$2.50`/M out (flash-class) | `~$0.005–0.01` |
| Functions compute | ~7.5 invocations × ~3 s × 512 MiB | `~$0.0000025`/GiB-s + `~$0.40`/M invoc. | `~$0.0003` |
| Firestore | ~20 reads, ~10 writes (boot, missions, stats counters) | `~$0.06`/100k reads, `~$0.18`/100k writes | `~$0.00003` |
| Hosting egress | ~1–2 MB app + images first load | `~$0.15`/GB past free | `~$0.0002` |
| Storage (gallery tiers only) | ~5 kept photos × ~300 KB | `~$0.026`/GB-mo | `~$0.00004`/mo |
| Auth | signed-in fans only | $0 (no SMS) | $0 |

**Total: `~$0.01–0.02` per player, ≥95% of it the vision model.** Every
other line is rounding error — which is why `verifyPerDay` is the only
usage knob worth metering.

**Where infra stops being ~$0** (free tiers as remembered — re-verify:
Firestore `~50k` reads/`~20k` writes/day, Functions `~2M` invocations/mo,
Hosting `~360MB`/day egress, Storage `~5GB`): a single Venue event day
(5,000 players ≈ 37k verifications, ~7 GB hosting egress, ~100k Firestore
ops) blows through the daily free quotas **on day one of production**. So:
infra is literally ~$0 through all of local dev and Free/Event-scale usage
(emulators are offline, verified `README.md`), and becomes
tens-of-dollars-per-event-day the moment the first venue goes live — with
revenue attached to that same day.

## 7. Scenarios

Season-month figures; Venue revenue = annual fee amortized + event-day
blocks (~6 home dates/mo in season).

| Stage | Venues | Business subs | Event sales/mo | Players/mo | Infra/mo | Revenue/mo | Stripe fees | Gross margin |
|---|---|---|---|---|---|---|---|---|
| **Pilot** (Phase 1 live) | 1 (hand-billed) | 0 | 0 | ~30k | `~$60–150` | `~$1,500` | ~$0 (invoice/check) | `~92%` |
| **Traction** (Phase 2 ships) | 2 | 5 | 20 | ~70k | `~$150–350` | `~$4,800` | `~$80` | `~91%` |
| **Real business** | 6 | 40 | 100 | ~250k | `~$500–1,200` | `~$21,400` | `~$450` | `~92%` |
| **Scale** | 20 | 150 | 400 | ~800k | `~$1,700–4,000` | `~$79,000` | `~$1,800` | `~93%` |

**The ramp story:** costs are almost purely demand-driven and arrive in the
same month as the usage that generates them — but Venue cash arrives
*ahead* of usage (annual fee + event blocks invoiced up front), so the cash
curve leads the cost curve at exactly the stage (Pilot) where that matters
most. There is no infra cliff to pre-buy; `maxInstances: 10` (verified,
`api.ts:82`) is the only scaling knob and it's a config line.

**What the ~92% gross margin actually pays for, in arrival order:**
(1) **event-day support** — a venue hunt failing live is the churn event,
so on-call during game windows is the first real operating cost, from the
first contract; (2) **compliance** — COPPA/GDPR counsel and a real DPA
template the moment Phase 2 retention/rosters ship, *before* the first
wedding gallery, not after; (3) **sales** — Venue deals are relationship
sales; a founder does them until ~6 venues, then it's a hire. Product
engineering rides throughout.

**Sensitivity — the scariest line is the Gemini multiplier:** cost =
players × missions × **attempts** × **price/call**, and we control neither
right-hand factor. If retry behavior is 4× the 1.5 guess *and* the pinned
model's successor prices 3× higher, player cost hits `~$0.06–0.12` — Venue
event-day margin thins but holds; **Free is the exposed tier**, which is
why `verifyPerDay: 1_000` (one knob, `PLAN_LIMITS`) caps worst-case Free
burn at `~$1–3`/day/org. Instrument attempts-per-player from existing logs
(§2) and re-run this table with real numbers after the first month live.

## 8. Risks honestly stated

- **Single-customer concentration.** At Pilot, one club is 100% of revenue
  and its season schedule is the cash calendar. Mitigation is already the
  roadmap: Phase 2 self-serve exists precisely so revenue stops being one
  contract; until then, invoice annual fees up front.
- **Pinned-model retirement.** Google retires models for new keys; a
  retired `gemini-3.6-flash` 404s and the endpoint's fail-open design
  turns every capture into an auto-match (verified: outage → match by
  design, `docs/architecture.md`) — the product silently becomes
  honor-system. Mitigation exists in code comments (`vision.ts:27-30`:
  verify candidates via `GET /v1beta/models`) — promote it to an alert on
  `verificationLive`/model-404 rates in `GET /health` monitoring before
  the first paid event.
- **Payment failure / dunning.** A Business card failing mid-quarter must
  not brick a scheduled hunt. Designed in: `past_due` grace ≥ one billing
  cycle, downgrades at period end, never mid-event, read-only + export at
  lapse (§3).
- **Underpricing Venue.** One datapoint, priced by arithmetic. Mitigation:
  the first contracts are explicitly pilot-priced with a written year-2
  repricing clause tied to measured usage, and the instrumentation in §2
  exists to make that conversation factual.
- **Free-tier abuse of a paid API.** Unauthenticated `verify-capture` is a
  spend surface (already acknowledged in code, `api.ts:172-176`).
  Designed in: per-IP limiter (exists) + per-tenant `verifyPerDay` bucket
  (Phase 2) + Free caps.
- **Compliance shock when retention ships.** The moment a wedding gallery
  stores photos of guests (children among them), the org is a data
  controller and we're the processor. Designed in: retention is paid-only
  behind accepted terms, account+consent guardrail, self-serve deletion
  (`docs/platform-migration.md` § guardrails) — but the DPA and counsel
  review are a §7 cost that must land *before* the feature, and this doc
  is where that ordering is written down.
- **Churn timing is seasonal.** Clubs decide renewals in the off-season;
  a bad September conversation kills an April revenue line. Mitigation:
  season-end reports (the analytics already aggregate per hunt) delivered
  proactively, and annual invoicing so the renewal is an active decision
  with usage data on the table.
- **FX/inflation:** all-USD, US market (verified: en/es locales,
  `America/New_York` seed) — no FX exposure now; Stripe Tax decision (§4)
  is the nearer money-plumbing risk.

## 9. Later revenue (parked, not built)

- **AI hunt drafting as a paid feature** — `docs/hunt-generation.md`
  (verified) already specs the LLM prompt behind a future "Generate
  missions" button; vertical template packs (wedding/corporate/campus) are
  its productization. Natural Business/Venue-tier exclusive.
- **Player packs as a first-class SKU** — modeled in §5 (`playerPacks`),
  sold only reactively at first; a proactive "size your event" flow later.
- **Live-screen kit** — the `/:slug/live` jumbotron/reception display
  (migration § Positioning) as a Venue add-on with layouts/sponsor slots.
- **Sponsor slots, not data** — prize sponsorship surfaces (a brand funds
  the prize, gets the redeem-screen credit). Explicitly instead of
  monetizing behavioral data, which the architecture forbids and the
  customer base (minors) makes radioactive.
- **Custom domains** for Venue brand pages (`bats.huntima.app` /
  `hunt.batsbaseball.com`) — parked with the link-preview work.
- **Native app white-labeling** — per-club App Store shells via the
  existing Capacitor wrapper (`com.mtm.huntima`, verified) as a
  high-touch Venue add-on; deliberately deferred in the migration plan.
- **Platform accolade season passes** (Phase 3+) — consumer-side, only
  after the server ledger exists, and only if it can be priced without
  ever charging a minor: default assumption is it stays a Venue-funded
  engagement feature, not a fan purchase.
