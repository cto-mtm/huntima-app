import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import {
  campaignSchema,
  missionListSchema,
  SEED_CAMPAIGN,
  type Campaign,
  type CampaignInput,
  type Mission,
  type MissionList,
} from 'shared'

/**
 * Firestore storage for hunts.
 *
 * Missions are embedded in the campaign document rather than living in a
 * subcollection. A hunt has a handful of missions, every read wants all of
 * them, and publishing has to be atomic — a fan must never see a half-edited
 * hunt. One document gives all three for free.
 */
function db(): Firestore {
  if (getApps().length === 0) initializeApp()
  return getFirestore()
}

const COLLECTION = 'campaigns'

function sortMissions(missions: Mission[]): Mission[] {
  return [...missions].sort((a, b) => a.order - b.order)
}

export async function listCampaigns(): Promise<Campaign[]> {
  const snap = await db().collection(COLLECTION).get()
  return snap.docs
    .map((doc) => campaignSchema.safeParse({ id: doc.id, ...doc.data() }))
    .filter((r): r is { success: true; data: Campaign } => r.success)
    .map((r) => ({ ...r.data, missions: sortMissions(r.data.missions) }))
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  const doc = await db().collection(COLLECTION).doc(id).get()
  if (!doc.exists) return null

  const parsed = campaignSchema.safeParse({ id: doc.id, ...doc.data() })
  if (!parsed.success) return null

  return { ...parsed.data, missions: sortMissions(parsed.data.missions) }
}

export async function createCampaign(input: CampaignInput): Promise<Campaign> {
  const ref = db().collection(COLLECTION).doc()
  const campaign: Campaign = { id: ref.id, ...input, missions: [] }
  // Firestore rejects an `id` field clash only by convention; strip it so the
  // document id stays the single source of identity.
  const { id: _id, ...body } = campaign
  await ref.set(body)
  return campaign
}

export async function updateCampaign(
  id: string,
  patch: Partial<Omit<Campaign, 'id'>>,
): Promise<Campaign | null> {
  const ref = db().collection(COLLECTION).doc(id)
  if (!(await ref.get()).exists) return null
  await ref.update(patch)
  return getCampaign(id)
}

export async function deleteCampaign(id: string): Promise<boolean> {
  const ref = db().collection(COLLECTION).doc(id)
  if (!(await ref.get()).exists) return false
  await ref.delete()
  return true
}

/**
 * The fan-facing read.
 *
 * Falls back to the built-in demo campaign when no hunt has been published —
 * a fresh install must not show an empty app to a family that just scanned a
 * QR code on the jumbotron.
 */
export async function getPublishedMissionList(): Promise<MissionList> {
  try {
    const snap = await db().collection(COLLECTION).where('status', '==', 'published').limit(1).get()

    if (!snap.empty) {
      const doc = snap.docs[0]
      const parsed = campaignSchema.safeParse({ id: doc.id, ...doc.data() })
      if (parsed.success && parsed.data.missions.length > 0) {
        return missionListSchema.parse({
          campaignId: parsed.data.id,
          badgeTarget: parsed.data.badgeTarget,
          missions: sortMissions(parsed.data.missions),
        })
      }
    }
  } catch {
    // Firestore unreachable. The seed campaign is a better answer than a 500.
  }

  return SEED_CAMPAIGN
}

/** Looks a mission up for verification. Checks the seed too, so the demo works. */
export async function findMission(campaignId: string, missionId: string): Promise<Mission | null> {
  if (campaignId === SEED_CAMPAIGN.campaignId) {
    return SEED_CAMPAIGN.missions.find((m) => m.id === missionId) ?? null
  }
  const campaign = await getCampaign(campaignId)
  return campaign?.missions.find((m) => m.id === missionId) ?? null
}
