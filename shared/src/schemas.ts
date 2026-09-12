import { z } from 'zod'

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
})

export type Mission = z.infer<typeof missionSchema>

// ── Campaigns (a "hunt") ──────────────────────────────────────────────
export const campaignStatusSchema = z.enum(['draft', 'published'])

export const campaignSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(80),
  /** Only a published hunt is served to fans. */
  status: campaignStatusSchema,
  badgeTarget: z.number().int().positive().max(50),
  missions: z.array(missionSchema),
})

export type Campaign = z.infer<typeof campaignSchema>
export type CampaignStatus = z.infer<typeof campaignStatusSchema>

/** What `GET /missions` returns to a fan. */
export const missionListSchema = z.object({
  campaignId: z.string(),
  badgeTarget: z.number().int().positive(),
  missions: z.array(missionSchema),
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
  /** Short, fan-facing explanation when match is false. */
  reason: z.string().nullable(),
  /** True when the verdict came from the stub rather than the model. */
  stubbed: z.boolean(),
})

export type VerifyResult = z.infer<typeof verifyResultSchema>

// ── Seeded demo campaign ──────────────────────────────────────────────
/**
 * Used twice on purpose, from one place:
 *  - the API serves it when Firestore holds no published hunt yet
 *  - the app falls back to it when that request fails, because a stadium
 *    concourse is one of the worst RF environments a phone will ever see
 *
 * Its copy uses i18n KEYS. Staff-authored hunts use literal text instead —
 * see missionTextSchema.
 */
export const SEED_CAMPAIGN: MissionList = {
  campaignId: 'demo-campaign',
  badgeTarget: 5,
  missions: [
    { id: 'gate-statue', kind: 'photo', title: { key: 'missions.gateStatue.title' }, hint: { key: 'missions.gateStatue.hint' }, color: '#3b6ea5', targetImageUrl: null, order: 0 },
    { id: 'west-concourse', kind: 'photo', title: { key: 'missions.westConcourse.title' }, hint: { key: 'missions.westConcourse.hint' }, color: '#c7563f', targetImageUrl: null, order: 1 },
    { id: 'team-store', kind: 'photo', title: { key: 'missions.teamStore.title' }, hint: { key: 'missions.teamStore.hint' }, color: '#4f8a63', targetImageUrl: null, order: 2 },
    { id: 'foul-pole', kind: 'photo', title: { key: 'missions.foulPole.title' }, hint: { key: 'missions.foulPole.hint' }, color: '#8b6db3', targetImageUrl: null, order: 3 },
    { id: 'player-22', kind: 'spyglass', title: { key: 'missions.player22.title' }, hint: { key: 'missions.player22.hint' }, color: '#d09a2c', targetImageUrl: null, order: 4 },
    { id: 'mascot', kind: 'spyglass', title: { key: 'missions.mascot.title' }, hint: { key: 'missions.mascot.hint' }, color: '#2f8f9d', targetImageUrl: null, order: 5 },
  ],
}

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
  timezone: z.string().min(1).max(60),
  /** The full 50-900 ramp is derived from this one hex client-side. */
  brandBase: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accentBase: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  logoUrl: z.string().url().nullable(),
  avatars: z.array(tenantAvatarSchema).max(24),
})

export type TenantConfig = z.infer<typeof tenantConfigSchema>

/** What a brand-new deployment looks like before staff touch anything. */
export const SEED_TENANT: TenantConfig = {
  teamName: 'Louisville Bats',
  prizeLocation: 'the Main Team Store',
  badgeTarget: 5,
  timezone: 'America/New_York',
  brandBase: '#14284b',
  accentBase: '#c8102e',
  logoUrl: null,
  avatars: [],
}

// ── POST /echo (reference endpoint) ───────────────────────────────────
export const echoSchema = z.object({
  message: z.string().min(1, 'message is required'),
  name: z.string().optional(),
})

export type EchoInput = z.infer<typeof echoSchema>
