import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import {
  campaignSchema,
  missionListSchema,
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

  // Publishing is EXCLUSIVE. GET /missions serves the single published hunt
  // (`.limit(1)`), so two live at once makes the served hunt arbitrary — which
  // is exactly the "my custom hunt isn't showing, the seed one is" symptom.
  // The moment a hunt goes live, demote every other published hunt. This is the
  // "publishing replaces the live one" the admin UI already promises.
  if (patch.status === 'published') {
    const live = await db().collection(COLLECTION).where('status', '==', 'published').get()
    const stale = live.docs.filter((doc) => doc.id !== id)
    if (stale.length > 0) {
      const batch = db().batch()
      stale.forEach((doc) => batch.update(doc.ref, { status: 'draft' }))
      await batch.commit()
    }

    // Safety net: never publish an unwinnable hunt. The editor guards this too,
    // but this guarantees it regardless of how the status got flipped.
    const current = await getCampaign(id)
    if (current && current.missions.length > 0 && current.badgeTarget > current.missions.length) {
      await ref.update({ badgeTarget: current.missions.length })
    }
  }

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
  const snap = await db().collection(COLLECTION).where('status', '==', 'published').limit(1).get()

  if (!snap.empty) {
    const doc = snap.docs[0]
    const parsed = campaignSchema.safeParse({ id: doc.id, ...doc.data() })
    if (parsed.success && parsed.data.missions.length > 0) {
      return missionListSchema.parse({
        campaignId: parsed.data.id,
        name: parsed.data.name,
        badgeTarget: parsed.data.badgeTarget,
        prize: parsed.data.prize,
        missions: sortMissions(parsed.data.missions),
      })
    }
  }

  // No published hunt. Return an explicit empty list rather than the seed:
  // the fan hub must reflect the real backend and show its empty state.
  // A Firestore error is intentionally NOT swallowed here — it propagates so
  // GET /missions answers 500, and the client shows "couldn't load" rather
  // than a misleading "nothing published yet".
  return { campaignId: '', name: '', badgeTarget: 1, missions: [] }
}

/** Looks a mission up for verification against the stored campaign. */
export async function findMission(campaignId: string, missionId: string): Promise<Mission | null> {
  const campaign = await getCampaign(campaignId)
  return campaign?.missions.find((m) => m.id === missionId) ?? null
}
