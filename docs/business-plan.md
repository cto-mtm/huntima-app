# Business plan — Huntima

Companion to `docs/platform-migration.md`. That doc says how the platform is
built; this one says who pays for it and why. Numbers here are **working
hypotheses to validate**, not commitments — the point of writing them down is
to make the assumptions arguable.

## Positioning

A platform where organizers run **verified** photo hunts — captures judged by
a vision model, so completions, prizes, leaderboards and accolades are earned,
not honor-system. Two audiences, one product:

- **Brands / businesses (B2B, the revenue engine)** — sports venues, corporate
  team-building, campus orientation, retail activations, tourism boards.
  They buy *engagement*: branded page, verified participation, analytics,
  recurring campaigns.
- **Normal people (consumer, the funnel)** — weddings, parties, family
  reunions. They buy *one great event* (and its photo album). Every player at
  every hunt sees the product working; the free tier converts some of them
  into organizers. This is the Devpost/Typeform loop: participants become
  customers.

## The value metric: players per hunt ("hunters")

Price scales with **player count per hunt**, because that is simultaneously:

1. **What the organizer values** — headcount is how they already think about
   their event (a 12-person offsite vs. a 5,000-fan game day).
2. **What drives our marginal cost** — each capture attempt is a paid Gemini
   call. Cost tracks players × missions × attempts almost linearly.
3. **Trivially explainable** — no seat licenses, no "MAU", no credit math.

Hunts and admin seats are NOT the metric: unlimited hunts and members on paid
tiers makes the product sticky and costs us ~nothing (Firestore reads round to
zero next to vision calls).

## Tiers (hypothesis)

| | Free | Event (one-off) | Business (subscription) | Venue (contract) |
|---|---|---|---|---|
| For | trying it / tiny groups | weddings, parties | team-building, campus, retail | stadiums, franchises |
| Players per hunt | 10 | up to 100 | up to 250 per hunt | thousands (5k+ per event day) |
| Price | $0 | ~$79 one-time | ~$149/mo | custom: annual + per-event-day blocks |
| Hunts | 1 active | 1 hunt, 30-day window | unlimited | unlimited, season-long |
| Photo policy | discard only | **gallery** (the album is the sell) | all policies + roster export | all policies + aggregate default (minors) |
| Brand page | platform-branded | light branding | full brand page, custom colors/logo | full + custom domain later |
| Analytics | basic counts | basic | full per-hunt analytics | full + season/cross-hunt views |
| Competition (Phase 3) | — | leaderboard | leaderboards, team play | + platform accolades, season passes |
| Extras | — | — | — | SLA, onboarding, jumbotron/live-screen kit |

Overage: player-count caps are **soft** — the hunt never breaks mid-event
(a wedding where guest #101 gets an error is a churned customer *and* a
ruined toast). Overage triggers an upgrade prompt to the organizer and is
billed as player packs (+100 players) after the fact for paid tiers; the free
tier just stops admitting new players past the cap, gently.

The Free→Event boundary is deliberately below a corporate team (12 players):
a company offsite is a paying customer, a family game night is not.

## Unit economics (order-of-magnitude, validate against real usage)

The dominant marginal cost is capture verification. Rough shape:

```
cost per player ≈ missions × attempts × cost per Gemini vision call
      e.g.      ≈ 5 × 1.5 × ~$0.001–0.003  ≈  $0.01–0.02 per player
```

- **Venue event day, 5,000 players** → ~37k verifications ≈ **$40–110 in
  model cost** per game. Priced as a per-event-day block in the hundreds,
  margin is healthy even before the annual platform fee.
- **Business hunt, 50 players** → pennies. The subscription is effectively
  pure margin; its price is set by value (engagement + analytics), not cost.
- **Event, 100 players** → well under $2 of model cost against ~$79; storage
  for a retained gallery (≈100 players × 5 photos × ~300 KB ≈ 150 MB) is
  cents per month. Time-box gallery retention (e.g. 90 days, then export or
  expire) so "forever" is never accidentally promised.
- **Free tier worst case** is bounded by design: 10 players × 1 hunt ≈ <$1
  per org even with heavy retries, plus the per-tenant daily budget below.

Fixed costs (Firebase functions/Firestore/Hosting) are spiky but small; the
architecture already optimizes the spike path (bundled function cold starts,
single-doc tenant reads).

## Enforcement maps onto architecture already planned

No paywall code exists yet and none ships in Phase 1 — but Phase 1 leaves the
exact seams this model needs:

- **The plan lives on the tenant doc** (`tenants/{slug}`: `plan`, `limits`,
  `billing` — server-written, like `createdBy`; never client-writable, same
  rule as the slug).
- **The per-tenant verify-capture budget bucket** (migration plan, S1) *is*
  the enforcement point for player-scale limits — the billing tier just sets
  the bucket size.
- **Player counting**: `POST /t/:slug/campaigns/:id/events` `participant`
  events already approximate unique players per hunt; good enough for soft
  caps and upgrade prompts. Exact metering can wait for the Phase 3 server
  ledger.
- **Feature gates** (gallery, roster, live screen, leaderboards) hang off the
  per-hunt data policy and Phase 2/3 features — each checks `tenant.plan`
  server-side, in the same place membership is checked.
- **Billing provider** (Stripe: Checkout + customer portal, one-time for
  Event, subscription for Business, invoicing for Venue) is a Phase 2 item,
  after self-serve org creation exists — there is nothing to sell a checkout
  to before that.

## Go-to-market sequence

1. **Now → Phase 1 ships**: land Venue deals directly (existing relationships,
   e.g. Louisville Bats). Contract pricing, hand onboarding. Venues fund the
   platform build and prove the 5k-player spike story.
2. **Phase 2**: open self-serve with Free + Event. The wedding/party vertical
   is the growth loop (every guest is a future organizer) — this is where
   Gathershot-category demand gets captured by a strictly more capable
   product.
3. **Phase 2.5+**: Business subscriptions once self-serve organizers exist to
   upgrade. Corporate team-building converts from Event one-offs ("run this
   quarterly" → subscribe).
4. **Phase 3**: accolades/leaderboards deepen Venue renewals (season-long
   engagement is what a club renews annually) and justify Business price.

## Open questions (decide before Phase 2 billing ships)

- Event tier price point ($49/$79/$99) and whether gallery retention is
  90 days or tied to a small keep-forever add-on.
- Whether Venue is priced per event day, per season, or per active-player
  band — needs one real season of usage data from the first venue.
- Category pricing check against GooseChase/Scavify/Gathershot's current
  public pricing (verify online before committing numbers — comps here are
  from memory and the category reprices often).
- Whether the Free tier allows photo retention at all (current call: no —
  retention implies data-controller obligations we only want from paying,
  terms-accepting orgs).
- Nonprofit/education discount — likely yes, decide the mechanism (coupon vs
  tier) when Stripe lands.
