import { z } from 'zod'

/**
 * The wire format between the app and the Cloud Functions API.
 *
 * This module is the single definition of every request body and response
 * payload. The API parses against it before responding; the client parses
 * against it before rendering. If the two ever disagree, it is a build
 * error here rather than an `undefined` in a template at a sold-out game.
 *
 * Rules for this package:
 * - No Firebase imports, no Vue imports, no DOM or Node globals. It is
 *   bundled into the function AND shipped to the browser.
 * - Runtime values (schemas, seed data) are fine; that is the whole point
 *   of using zod rather than bare types.
 */

// ── POST /echo ────────────────────────────────────────────────────────
// Reference endpoint: shows request validation end to end.
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
// Both fields exist so swapping one for the other is a data change, not a
// contract change.
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
 * Seeded demo campaign.
 *
 * Used twice on purpose, and now from one place:
 *  - the API serves it from `GET /missions`
 *  - the app falls back to it when that request fails, because a stadium
 *    concourse is one of the worst RF environments a phone will ever see
 *
 * SEAM: the API side becomes a Firestore read. This constant stays as the
 * offline/demo campaign.
 *
 * Note the title/hint values are i18n KEYS, not display strings — see
 * docs/i18n.md § "Translate data, not just UI chrome".
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
