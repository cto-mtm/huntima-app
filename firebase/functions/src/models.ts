import { z } from 'zod'

/**
 * Every request body and every response payload gets a schema here.
 *
 * Requests are parsed (so bad input becomes a 400 with field-level detail
 * instead of a 500). Responses are typed from the same schemas, so the
 * client contract lives in exactly one place.
 */

// ── POST /echo ────────────────────────────────────────────────────────
// The reference endpoint: shows request validation end to end.
export const echoSchema = z.object({
  message: z.string().min(1, 'message is required'),
  name: z.string().optional(),
})

export type EchoInput = z.infer<typeof echoSchema>

// ── GET /missions ─────────────────────────────────────────────────────
// The campaign a fan sees when they open the app.
//
// `kind` distinguishes the two capture mechanics:
//   'photo'    — walk the concourse and recreate a target photo
//   'spyglass' — point at the field and frame a live-action target
//
// `color` is a placeholder for `imageUrl`: until the admin tool can upload
// real clue photos to Cloud Storage, the client renders a colored block.
// Both fields are in the schema so swapping one for the other later is a
// data change, not a contract change.
export const missionSchema = z.object({
  id: z.string(),
  kind: z.enum(['photo', 'spyglass']),
  titleKey: z.string(),
  hintKey: z.string(),
  color: z.string(),
  imageUrl: z.string().url().nullable(),
})

export const missionListSchema = z.object({
  campaignId: z.string(),
  badgeTarget: z.number().int().positive(),
  missions: z.array(missionSchema),
})

export type Mission = z.infer<typeof missionSchema>
export type MissionList = z.infer<typeof missionListSchema>

/**
 * Seeded campaign.
 *
 * SEAM: this is the Firestore read. Replace the constant with a query
 * (`getFirestore().collection('campaigns').doc(id)`) and nothing on the
 * client changes — `missionListSchema` is the contract.
 *
 * Note the title/hint values are i18n KEYS, not display strings. Once the
 * admin campaign builder exists, staff-authored missions will instead carry
 * per-locale text; the client resolves whichever it is given.
 */
export const SEED_CAMPAIGN: MissionList = {
  campaignId: 'demo-campaign',
  badgeTarget: 5,
  missions: [
    {
      id: 'gate-statue',
      kind: 'photo',
      titleKey: 'missions.gateStatue.title',
      hintKey: 'missions.gateStatue.hint',
      color: '#3b6ea5',
      imageUrl: null,
    },
    {
      id: 'west-concourse',
      kind: 'photo',
      titleKey: 'missions.westConcourse.title',
      hintKey: 'missions.westConcourse.hint',
      color: '#c7563f',
      imageUrl: null,
    },
    {
      id: 'team-store',
      kind: 'photo',
      titleKey: 'missions.teamStore.title',
      hintKey: 'missions.teamStore.hint',
      color: '#4f8a63',
      imageUrl: null,
    },
    {
      id: 'foul-pole',
      kind: 'photo',
      titleKey: 'missions.foulPole.title',
      hintKey: 'missions.foulPole.hint',
      color: '#8b6db3',
      imageUrl: null,
    },
    {
      id: 'player-22',
      kind: 'spyglass',
      titleKey: 'missions.player22.title',
      hintKey: 'missions.player22.hint',
      color: '#d09a2c',
      imageUrl: null,
    },
    {
      id: 'mascot',
      kind: 'spyglass',
      titleKey: 'missions.mascot.title',
      hintKey: 'missions.mascot.hint',
      color: '#2f8f9d',
      imageUrl: null,
    },
  ],
}
