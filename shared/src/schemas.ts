import { z } from 'zod'
import { planSchema } from './plans.js'

/**
 * The wire format between the app and the Cloud Functions API.
 *
 * This module is the single definition of every request body and response
 * payload. The API parses against it before responding; the client parses
 * against it before rendering. If the two ever disagree, it is a build error
 * here rather than an `undefined` in a template at a sold-out game.
 *
 * Rules for this package:
 * - No Firebase imports, no Vue imports, no DOM or Node globals. It is
 *   bundled into the function AND shipped to the browser.
 * - Runtime values (schemas, seed data) are fine; that is the whole point of
 *   using zod rather than bare types.
 */

// ── Tenant slugs (org identity in every URL) ──────────────────────────
/**
 * The slug IS the tenant id: `huntima.app/louisville-bats` and Firestore's
 * `tenants/louisville-bats` are the same string. One definition here, used by
 * the API router, the app router guard, and org creation — so a slug that
 * parses anywhere parses everywhere.
 *
 * Lowercase alphanumerics with single interior hyphens, 3–50 chars. Renames
 * are deliberately not supported (a rename is a document move; ship it later
 * as copy + redirect-stub if ever needed).
 */
export const TENANT_SLUG_PATTERN = /^[a-z0-9](?:-?[a-z0-9]){2,49}$/

/**
 * Every current top-level route plus platform words we will want later. A fan
 * URL and an app route must never collide — `/orgs` the org picker and
 * `/orgs` the ball club cannot both exist.
 */
export const RESERVED_SLUGS = new Set([
  'admin',
  'api',
  'app',
  'about',
  'dev',
  'explore',
  'health',
  'help',
  'home',
  'me',
  'missions',
  'orgs',
  'pricing',
  'privacy',
  'profile',
  'redeem',
  'signin',
  'staff-login',
  'support',
  't',
  'terms',
  'trophies',
  'welcome',
  'www',
])

export const tenantSlugSchema = z
  .string()
  .min(3)
  .max(50)
  .regex(TENANT_SLUG_PATTERN, 'Lowercase letters, numbers and hyphens only')
  .refine((s) => !RESERVED_SLUGS.has(s), { message: 'This name is reserved' })

export type TenantSlug = z.infer<typeof tenantSlugSchema>

/** Cheap boolean form for hot paths (router guards, URL parsing). */
export function isValidTenantSlug(value: string): boolean {
  return tenantSlugSchema.safeParse(value).success
}

/**
 * Why a slug was refused, as a code the UI can turn into its own sentence.
 *
 * `tenantSlugSchema` deliberately conflates the two failures into one parse
 * error, which makes for a misleading form: someone typing `help` is told to
 * use 3–50 letters and numbers, which is exactly what they did. A reserved
 * word is a different problem from a malformed one, and the person fixing it
 * needs to know which.
 */
export type SlugRejection = 'ok' | 'format' | 'reserved'

export function slugRejection(value: string): SlugRejection {
  if (RESERVED_SLUGS.has(value)) return 'reserved'
  return value.length >= 3 && value.length <= 50 && TENANT_SLUG_PATTERN.test(value)
    ? 'ok'
    : 'format'
}

// ── Org membership ────────────────────────────────────────────────────
/**
 * Access to an org is a MEMBERSHIP DOCUMENT (`tenants/{slug}/members/{uid}`),
 * not a custom claim. Claims cap at 1000 bytes (a ceiling on orgs per user)
 * and lag behind token refresh; a document revokes instantly and is checkable
 * from the API and from Firestore/Storage rules alike.
 *
 * The global `admin` claim survives with a new meaning: PLATFORM OPERATOR.
 * It bypasses membership everywhere — the support/ops axis, never handed to
 * a customer.
 *
 * `uid` is stored redundantly as a field so `GET /me/orgs` can be a single
 * collection-group query (`members` where uid == caller).
 */
export const orgRoleSchema = z.enum(['owner', 'editor'])
export type OrgRole = z.infer<typeof orgRoleSchema>

/**
 * What a tenant IS, which is not the same question as who can edit it.
 *
 * `personal` — one person's own space, created implicitly the first time they
 *   start a hunt. They never asked for an organization and are never shown the
 *   word: a wedding host has an address and some hunts, not a company.
 * `org`      — a club, company or venue, created deliberately. It is the thing
 *   that wants branding, a team of staff and, in time, a bill.
 *
 * Both are the same document with the same subcollections, because everything
 * a hunt needs (an address, branding, storage, analytics, membership) hangs
 * off a tenant. Splitting them into two entities would duplicate all of it to
 * express what is really a difference in VOCABULARY and in how much setup a
 * person should be asked for. Server-written and never editable through the
 * branding form, so an org cannot quietly become a personal space.
 */
export const tenantKindSchema = z.enum(['personal', 'org'])
export type TenantKind = z.infer<typeof tenantKindSchema>

export const orgMemberSchema = z.object({
  uid: z.string().min(1).max(128),
  role: orgRoleSchema,
  /** Epoch ms. */
  addedAt: z.number().int().nonnegative(),
  /** uid of who granted it ('seed' / 'migration' for scripts). */
  addedBy: z.string().min(1).max(128),
})

export type OrgMember = z.infer<typeof orgMemberSchema>

/** One row of `GET /me/orgs` — enough to render the org picker. */
export const orgSummarySchema = z.object({
  slug: z.string().min(1).max(50),
  teamName: z.string().max(60),
  role: z.union([orgRoleSchema, z.literal('operator')]),
  /** Defaulted for tenants created before the split, which were all orgs. */
  kind: tenantKindSchema.default('org'),
  /** Billing plan — the capability axis. Defaulted for tenants written before
   *  the field existed (all free). Drives console gating (branding, caps). */
  plan: planSchema.default('free'),
})

export type OrgSummary = z.infer<typeof orgSummarySchema>

export const myOrgsSchema = z.object({ orgs: z.array(orgSummarySchema).max(200) })
export type MyOrgs = z.infer<typeof myOrgsSchema>

/** Body of `POST /orgs`. Branding starts from SEED_TENANT with this name. */
export const createOrgSchema = z.object({
  slug: tenantSlugSchema,
  teamName: z.string().min(1).max(60),
})

export type CreateOrgInput = z.infer<typeof createOrgSchema>

/**
 * Body of `POST /me/hunts` — the consumer path, and deliberately one field.
 *
 * Starting a hunt used to mean creating an "organization" first: a second
 * name, and a web address to negotiate, before you could type a single
 * mission. A person running a wedding hunt has one thing in their head, and
 * being asked to found an institution around it is the wrong question.
 *
 * The server finds this account's personal space or creates one, then puts a
 * draft hunt inside it. `handle` is only consulted when there is no personal
 * space yet: it is the address that account's page will live at forever, so
 * it is offered as a prefilled suggestion rather than a demand. Omitted, the
 * server derives one.
 */
export const createHuntSchema = z.object({
  name: z.string().min(1).max(80),
  handle: tenantSlugSchema.optional(),
})

export type CreateHuntInput = z.infer<typeof createHuntSchema>

/** What `POST /me/hunts` answers: where the new draft lives. */
export const createdHuntSchema = z.object({
  tenantSlug: z.string().min(1).max(50),
  campaignId: z.string().min(1).max(200),
  /** True when this call also created the account's personal space. */
  createdSpace: z.boolean(),
})

export type CreatedHunt = z.infer<typeof createdHuntSchema>

/**
 * `GET /orgs/slug-available?slug=…` — the claim-your-URL probe.
 *
 * Answered before the form is submitted so a taken or reserved address is a
 * correction while the organizer is still typing the name, not a rejection
 * after they committed to it. `reason` is null exactly when available.
 */
export const slugAvailabilitySchema = z.object({
  slug: z.string().max(50),
  available: z.boolean(),
  reason: z.union([z.literal('taken'), z.literal('reserved'), z.literal('format'), z.null()]),
})

export type SlugAvailability = z.infer<typeof slugAvailabilitySchema>

/**
 * Body of `POST /t/:slug/admin/members` — an owner invites a colleague by
 * the email their account already uses. There is no invitation email and no
 * pending state: the account must exist, which keeps the member list a list of
 * real people rather than a list of hopes.
 */
export const addMemberSchema = z.object({
  email: z.string().email().max(200),
  role: orgRoleSchema,
})

export type AddMemberInput = z.infer<typeof addMemberSchema>

/**
 * One row of `GET /t/:slug/admin/members`.
 *
 * `email` is resolved from Auth at read time rather than copied onto the
 * membership document: a stored address goes stale the day someone changes
 * theirs, and a console showing a stale address is how the wrong person keeps
 * access. Null when the account has since been deleted.
 */
export const orgMemberRowSchema = z.object({
  uid: z.string().min(1).max(128),
  email: z.string().max(200).nullable(),
  role: orgRoleSchema,
})

export type OrgMemberRow = z.infer<typeof orgMemberRowSchema>

export const orgMembersSchema = z.object({ members: z.array(orgMemberRowSchema).max(100) })
export type OrgMembers = z.infer<typeof orgMembersSchema>

// ── Mission text ──────────────────────────────────────────────────────
/**
 * Mission copy comes from two places that must not be confused.
 *
 * `{ key }`  — an i18n message key. Used by the built-in demo campaign, so
 *              it renders in the fan's language.
 * `{ text }` — literal words typed by stadium staff in the admin tool. That
 *              is user-generated content: it is shown verbatim and is NOT
 *              translated, exactly like a fan's nickname.
 *
 * A union rather than two optional fields, so "neither" and "both" are
 * unrepresentable instead of merely discouraged.
 */
export const missionTextSchema = z.union([
  z.object({ key: z.string().min(1) }),
  z.object({ text: z.string().min(1).max(200) }),
])

export type MissionText = z.infer<typeof missionTextSchema>

// ── Missions ──────────────────────────────────────────────────────────
export const missionKindSchema = z.enum(['photo', 'spyglass'])

export const missionSchema = z.object({
  id: z.string().min(1),
  kind: missionKindSchema,
  title: missionTextSchema,
  hint: missionTextSchema,
  /** Placeholder block color, shown until a target photo is uploaded. */
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  /**
   * The staff-uploaded reference photo. Serves double duty: it is the clue
   * the fan is shown, and the image their capture is compared against.
   * Null means this mission runs on the written hint alone.
   */
  targetImageUrl: z.string().url().nullable(),
  /** Display order in the fan's list. */
  order: z.number().int().nonnegative(),
  /**
   * Optional level/chapter this mission belongs to ("Level 1: Rookie").
   *
   * Same two-source union as every other piece of mission copy: an i18n key
   * for built-in content, literal words for anything staff typed. Nullable
   * with a default so every hunt authored before levels existed keeps
   * parsing — those missions render as one unnamed group, which is exactly
   * the flat list they already were.
   *
   * Grouping is DISPLAY only. It never gates a mission: a fan can collect
   * level 3 before level 1, because the alternative is a stadium full of
   * people stuck behind a mission whose subject walked away.
   */
  group: missionTextSchema.nullable().default(null),
  /**
   * Where this mission is in the real world: a geographic point, plus an
   * optional hint radius, rendered on a Leaflet + OpenStreetMap map.
   *
   * `radiusMeters` is a wayfinding HINT, not a geofence: 0 means "show a
   * precise pin", and any positive value means "show a circle of about this
   * size" so a city-wide hunt can point players at a general area rather than
   * an exact doorstep. It does NOT gate captures — whether a fan is really at
   * the venue stays the separate soft check against `tenantConfig.venue`.
   *
   * Null means the mission has no location (runs on the written hint alone),
   * in which case it draws no pin and shows no map icon.
   */
  geo: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      radiusMeters: z.number().nonnegative().max(50_000).default(0),
    })
    .nullable()
    .default(null),
})

export type Mission = z.infer<typeof missionSchema>

// ── Prizes ─────────────────────────────────────────────────────────────
/**
 * What a fan wins by completing a hunt. Configured per-hunt in the admin
 * editor and shown on the redeem screen.
 *
 * Optional on the campaign so a hunt created before prizes existed still
 * parses — an absent prize (or an empty `name`) simply means "no prize set".
 * `winnerLimit` records the intended cap (e.g. "first 10"); live availability
 * would need server-side redemption, which is still a seam.
 */
export const prizeSchema = z.object({
  name: z.string().max(80),
  description: z.string().max(500),
  imageUrl: z.string().url().nullable(),
  /** Intended number of winners. 0 = no stated limit. */
  winnerLimit: z.number().int().nonnegative().max(1_000_000),
})

export type Prize = z.infer<typeof prizeSchema>

// ── Campaigns (a "hunt") ──────────────────────────────────────────────
export const campaignStatusSchema = z.enum(['draft', 'published'])

export const campaignSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(80),
  /** Only a published hunt is served to fans. */
  status: campaignStatusSchema,
  badgeTarget: z.number().int().positive().max(50),
  prize: prizeSchema.optional(),
  missions: z.array(missionSchema),
})

export type Campaign = z.infer<typeof campaignSchema>
export type CampaignStatus = z.infer<typeof campaignStatusSchema>

/** What `GET /missions` returns to a fan. */
export const missionListSchema = z.object({
  // Bounded to match campaignSchema: an empty campaignId gets posted straight
  // back on /verify-capture, and an empty/overlong name becomes a blank or
  // truncated trophy. The empty-state payload uses '' deliberately, so these
  // allow zero length here (unlike campaignSchema) but still cap the max.
  campaignId: z.string().max(200),
  /** The hunt's name, so a completed hunt can be shown as a named trophy. */
  name: z.string().max(80),
  badgeTarget: z.number().int().positive(),
  prize: prizeSchema.optional(),
  missions: z.array(missionSchema).max(50),
})

export type MissionList = z.infer<typeof missionListSchema>

// ── Admin write payloads ──────────────────────────────────────────────
export const campaignInputSchema = campaignSchema.omit({ id: true, missions: true })

/**
 * Body of `PUT /admin/campaigns/:id/missions`.
 *
 * Whole-list replace: the editor reorders and edits together, and a hunt a
 * fan might be mid-way through must never be half-updated. Missions arrive
 * with client-generated ids, which is why there is no id-less input variant.
 */
export const missionListPayloadSchema = z.object({
  missions: z.array(missionSchema).max(50),
})

export type CampaignInput = z.infer<typeof campaignInputSchema>
export type MissionListPayload = z.infer<typeof missionListPayloadSchema>

// ── Capture verification ──────────────────────────────────────────────
/**
 * A fan's capture, posted for verification.
 *
 * The image travels in the request body and is never written to storage —
 * see storage.rules. Photographs taken by children in a public venue are not
 * something to accumulate.
 *
 * Base64 rather than multipart because the payload is one small JPEG and
 * this keeps the function dependency-free. The cap is deliberately low: the
 * client downscales before sending, because uploading a 12 MP photo over
 * stadium wifi fails long before the model ever sees it.
 */
export const verifyCaptureSchema = z.object({
  campaignId: z.string().min(1),
  missionId: z.string().min(1),
  /** Bare base64, no data: prefix. ~1.4 MB of base64 ≈ 1 MB of JPEG. */
  imageBase64: z.string().min(32).max(1_400_000),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
})

export type VerifyCaptureInput = z.infer<typeof verifyCaptureSchema>

export const verifyResultSchema = z.object({
  match: z.boolean(),
  /** 0–1. Staff see this on low-confidence captures. */
  confidence: z.number().min(0).max(1),
  /** Short, fan-facing explanation when match is false. Capped like every
   *  other fan-facing string; the model is instructed to write one sentence
   *  but the ceiling guards against a runaway response. */
  reason: z.string().max(300).nullable(),
  /** True when the verdict came from the stub rather than the model. */
  stubbed: z.boolean(),
})

export type VerifyResult = z.infer<typeof verifyResultSchema>

// ── Per-hunt analytics ─────────────────────────────────────────────────
/**
 * Deliberately AGGREGATE only: counters, never a per-person row.
 *
 * A fan is anonymous to the server (no account, a device id that never leaves
 * the phone), so there is no trusted identity to attribute a row to — and these
 * are children at a public venue, whose behaviour we have chosen not to store.
 * "How many / when" is answerable from sums; "who" is not asked.
 *
 * `participants` and `completions` are reported by the client, which fires each
 * at most once per device per hunt, so they approximate unique people without
 * the server keeping the device ids that would make them exact. `captures` and
 * `matches` are counted server-side in `POST /verify-capture`, so they are
 * exact. `hours` buckets capture activity by UTC hour (key `YYYY-MM-DDTHH`) to
 * answer "when did they do it" — the client renders it in the club's timezone.
 */
export const campaignEventKindSchema = z.enum(['participant', 'completion'])
export type CampaignEventKind = z.infer<typeof campaignEventKindSchema>

/** Body of `POST /campaigns/:id/events`. */
export const campaignEventSchema = z.object({ kind: campaignEventKindSchema })
export type CampaignEvent = z.infer<typeof campaignEventSchema>

export const campaignStatsSchema = z.object({
  participants: z.number().int().nonnegative(),
  completions: z.number().int().nonnegative(),
  captures: z.number().int().nonnegative(),
  matches: z.number().int().nonnegative(),
  /** Capture activity by UTC hour. Key `YYYY-MM-DDTHH`, value a count. */
  hours: z.record(z.string(), z.number().int().nonnegative()),
})
export type CampaignStats = z.infer<typeof campaignStatsSchema>

// ── Fan progress (cross-device continuity) ────────────────────────────
/**
 * A signed-in fan's progress, made durable so their trophies follow them to a
 * new phone instead of living only in one device's localStorage.
 *
 * IMPORTANT — this is NOT a trusted ledger. It is the fan's OWN self-reported
 * progress: the server stores, keyed by their verified uid, exactly what their
 * client sends. It must never be the basis for handing over a prize without
 * staff verification — the same forgeable-claim-code caveat as today (see
 * docs/architecture.md § Seams). Making badges server-authoritative (awarded on
 * a verified capture) is a separate, larger change; this only buys continuity.
 *
 * Guests have no uid and never reach this — they stay device-local.
 *
 * The `.max()` caps exist purely to bound what an authenticated client can push
 * into its own document; they are generous relative to any real hunt.
 */
export const wonHuntSchema = z.object({
  campaignId: z.string().min(1).max(200),
  /** The hunt's name at the time it was won, shown on the trophy shelf. */
  name: z.string().max(120),
  /** Epoch ms when the hunt was completed. */
  wonAt: z.number().int().nonnegative(),
  /**
   * Which org's hunt this was. Optional: trophies recorded before the
   * platform pivot lack it and must keep parsing. Campaign ids are globally
   * unique (Firestore auto-ids), so this is provenance for display, not a
   * key.
   */
  tenantSlug: z.string().max(60).optional(),
})

export type WonHunt = z.infer<typeof wonHuntSchema>

/**
 * A hunt the fan has JOINED but may not have finished — the "ongoing games"
 * on their platform home. Distinct from `wonHunts` (finished) and from
 * `earned` (per-campaign badge ids): this is the shortlist of brands worth
 * a "Continue" button, with just enough snapshot to render a card without
 * re-fetching every org.
 *
 * `badgeTarget` is snapshotted at join time so the card can show "3 / 8"
 * offline; the live hub is still authoritative once entered. Optional on
 * fanProgress so a doc written before this existed still parses.
 */
export const joinedHuntSchema = z.object({
  tenantSlug: z.string().min(1).max(60),
  /** The org's name at join time, for the card. */
  teamName: z.string().max(60),
  campaignId: z.string().min(1).max(200),
  /** Badges needed to win, snapshotted so the card renders offline. */
  badgeTarget: z.number().int().nonnegative().max(50),
  /** Epoch ms when first joined. */
  joinedAt: z.number().int().nonnegative(),
})

export type JoinedHunt = z.infer<typeof joinedHuntSchema>

export const fanProgressSchema = z.object({
  /** Fan-chosen display name. Empty string when they never set one. */
  nickname: z.string().max(60),
  /** Avatar id (never a URL), or null for the monogram fallback. */
  avatarId: z.string().max(64).nullable(),
  /** Earned badge ids, keyed by campaign id. */
  earned: z.record(z.string().max(200), z.array(z.string().max(200)).max(50)),
  /** Redeemed flag, keyed by campaign id. */
  claimed: z.record(z.string().max(200), z.boolean()),
  /** Finished hunts — the trophy shelf. */
  wonHunts: z.array(wonHuntSchema).max(200),
  /** Joined hunts — the "ongoing games" on platform home. Optional so a
   *  document written before this field existed still parses. */
  joinedHunts: z.array(joinedHuntSchema).max(200).optional(),
})

export type FanProgress = z.infer<typeof fanProgressSchema>

// ── Tenant branding ───────────────────────────────────────────────────
/**
 * A club's identity: the thing that makes this white-label product look like
 * one team's app rather than a template.
 *
 * Served from the API so every device in the building shows the same brand.
 * It used to live in localStorage, which meant two staff phones could show
 * two different clubs and a fan saw whatever their own browser happened to
 * hold. The client still caches it locally, but as a cache, not as the truth.
 */
export const tenantAvatarSchema = z.object({
  /** Stable across re-uploads; progress stores this, never the URL. */
  id: z.string().min(1),
  url: z.string().url(),
  /** Accessible name, derived from the file name at upload time. */
  label: z.string().min(1).max(40),
})

export type TenantAvatar = z.infer<typeof tenantAvatarSchema>

/**
 * Typeface, chosen from a fixed catalogue rather than typed freely.
 *
 * A key, never a font name: the value ends up in a Google Fonts URL, and an
 * arbitrary string from an admin form has no business being interpolated into
 * one. A closed set also means the app can ship the matching CSS stack and
 * weights, so a font either works properly or is not offered.
 *
 * `system` loads NOTHING — the zero-cost escape hatch for orgs that care
 * about every round trip. The platform DEFAULT is `inter` (the Huntima body
 * face); on stadium wifi that cost is paid once and mitigated with subset +
 * `font-display: swap` + preload in lib/fonts.ts, so text renders in the
 * fallback stack while it loads rather than blocking.
 */
export const FONT_CHOICES = [
  'system',
  'inter',
  'roboto',
  'open-sans',
  'montserrat',
  'oswald',
  'rubik',
  'barlow',
] as const

export const fontChoiceSchema = z.enum(FONT_CHOICES)
export type FontChoice = z.infer<typeof fontChoiceSchema>

/**
 * Optional stadium geofence, per club. When set, the fan app checks the device
 * is roughly here before allowing a capture — a SOFT gate (see useGeofence): it
 * blocks only a confident fix that is clearly outside, never a denied or fuzzy
 * one, because a concourse is a terrible place for GPS. The fan's location is
 * checked against this point and never stored. `null` = no restriction.
 */
export const venueSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusMeters: z.number().int().positive().max(50_000),
})

export type Venue = z.infer<typeof venueSchema>

export const tenantConfigSchema = z.object({
  /**
   * The club's name as it should appear. Do NOT append "Team": every surface
   * already reads as a team name, and "Riverdogs Team" is how a template
   * announces itself as a template.
   */
  teamName: z.string().min(1).max(60),
  prizeLocation: z.string().min(1).max(80),
  /** Pre-fetch default only. A loaded campaign is authoritative. */
  badgeTarget: z.number().int().positive().max(50),
  /**
   * An IANA time zone (e.g. `America/New_York`). Validated against the
   * platform's zone database rather than accepting any string, because the
   * value is handed to Intl.DateTimeFormat on the stats screen — a bad zone
   * throws a RangeError there, turning a typo in the branding form into a
   * crashed dashboard. `Intl.supportedValuesOf('timeZone')` isn't universal,
   * so probe by construction instead.
   */
  timezone: z
    .string()
    .min(1)
    .max(60)
    .refine(
      (tz) => {
        try {
          new Intl.DateTimeFormat('en-US', { timeZone: tz })
          return true
        } catch {
          return false
        }
      },
      { message: 'Invalid IANA time zone' },
    ),
  /** The full 50-900 ramp is derived from this one hex client-side. */
  brandBase: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accentBase: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  fontFamily: fontChoiceSchema,
  logoUrl: z.string().url().nullable(),
  avatars: z.array(tenantAvatarSchema).max(24),
  /** Optional stadium geofence. Absent on older tenants → defaults to null. */
  venue: venueSchema.nullable().default(null),
  /**
   * An illustrated plan of the venue — the ballpark, the vineyard, the
   * conference floor — that missions get pinned onto. Uploaded on the
   * Branding tab like any other tenant image.
   *
   * Per TENANT rather than per hunt: a club runs many hunts in one building.
   * `null` means no map, and the fan app simply never offers the map view.
   */
  venueMapUrl: z.string().url().nullable().default(null),
})

export type TenantConfig = z.infer<typeof tenantConfigSchema>

/**
 * The neutral Huntima starter brand. Three jobs, one definition:
 * what `createOrg` seeds a brand-new org with (before its owner touches
 * Branding), the app's platform-default theme on org-less pages (landing,
 * org picker), and the pre-network fallback while a real org's brand loads.
 *
 * Deliberately NOT any club's colors — a mistyped slug or a slow connection
 * must read as "Huntima, loading", never as the wrong team. Demo-club
 * branding (Louisville Bats etc.) lives in firebase/seed.mjs.
 *
 * Deep indigo (body ink) + electric orange (accent; the CTA gradient's far
 * end is DERIVED from it by hue rotation — orange→magenta). The orange
 * grades ~3:1 on white — "large text only", which is the accent's documented
 * role (badge numerals, CTAs, win states; see docs/branding.md).
 */
export const SEED_TENANT: TenantConfig = {
  teamName: 'Huntima',
  prizeLocation: 'the prize counter',
  badgeTarget: 5,
  timezone: 'America/New_York',
  brandBase: '#312e63',
  accentBase: '#f97316',
  fontFamily: 'inter',
  logoUrl: null,
  avatars: [],
  venue: null,
  venueMapUrl: null,
}

// ── POST /echo (reference endpoint) ───────────────────────────────────
export const echoSchema = z.object({
  message: z.string().min(1, 'message is required'),
  name: z.string().optional(),
})

export type EchoInput = z.infer<typeof echoSchema>
