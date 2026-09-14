import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, type Firestore, type QueryDocumentSnapshot } from 'firebase-admin/firestore'
import {
  campaignSchema,
  missionListSchema,
  type Campaign,
  type CampaignInput,
  type Mission,
  type MissionList,
} from 'shared'

/**
 * Firestore storage for hunts, one subcollection per org:
 * `tenants/{slug}/campaigns/{id}`.
 *
 * A subcollection rather than a `tenantId` field: security rules scope for
 * free, per-org delete/export stays a subtree, and the "exactly one
 * published" query stays single-field (no composite index). Campaign doc ids
 * are Firestore auto-ids — globally unique — which is what lets fan progress
 * stay keyed by campaignId alone.
 *
 * Missions stay embedded in the campaign document: a hunt has a handful of
 * steps, every read wants all of them, and publishing must be atomic.
 */
function db(): Firestore {
  if (getApps().length === 0) initializeApp()
  return getFirestore()
}

function campaignsCol(slug: string) {
  return db().collection('tenants').doc(slug).collection('campaigns')
}

function sortMissions(missions: Mission[]): Mission[] {
  return [...missions].sort((a, b) => a.order - b.order)
}

export async function listCampaigns(slug: string): Promise<Campaign[]> {
  const snap = await campaignsCol(slug).get()
  return snap.docs
    .map((doc) => campaignSchema.safeParse({ id: doc.id, ...doc.data() }))
    .filter((r): r is { success: true; data: Campaign } => r.success)
    .map((r) => ({ ...r.data, missions: sortMissions(r.data.missions) }))
}

export async function getCampaign(slug: string, id: string): Promise<Campaign | null> {
  const doc = await campaignsCol(slug).doc(id).get()
  if (!doc.exists) return null

  const parsed = campaignSchema.safeParse({ id: doc.id, ...doc.data() })
  if (!parsed.success) return null

  return { ...parsed.data, missions: sortMissions(parsed.data.missions) }
}

export async function createCampaign(slug: string, input: CampaignInput): Promise<Campaign> {
  const ref = campaignsCol(slug).doc()
  const campaign: Campaign = { id: ref.id, ...input, missions: [] }
  // Firestore rejects an `id` field clash only by convention; strip it so the
  // document id stays the single source of identity.
  const { id: _id, ...body } = campaign
  await ref.set(body)
  return campaign
}

export async function updateCampaign(
  slug: string,
  id: string,
  patch: Partial<Omit<Campaign, 'id'>>,
): Promise<Campaign | null> {
  const firestore = db()
  const ref = campaignsCol(slug).doc(id)

  // Publishing is EXCLUSIVE per org. GET /t/:slug/missions serves the single
  // published hunt (`.limit(1)`), so two live at once makes the served hunt
  // arbitrary. The whole publish runs as one transaction so concurrent
  // publishes serialize: every participant sees a consistent snapshot and
  // "exactly one published" holds under contention.
  const applied = await firestore.runTransaction(async (tx) => {
    const doc = await tx.get(ref)
    if (!doc.exists) return false

    // A publish must demote every OTHER published hunt in this org. Read them
    // INSIDE the transaction (before any write) so a concurrent publish is
    // serialized against this one rather than racing it.
    let stale: QueryDocumentSnapshot[] = []
    if (patch.status === 'published') {
      const live = await tx.get(campaignsCol(slug).where('status', '==', 'published'))
      stale = live.docs.filter((d) => d.id !== id)
    }

    tx.update(ref, patch)

    if (patch.status === 'published') {
      for (const d of stale) tx.update(d.ref, { status: 'draft' })
    }

    // Safety net: never leave a LIVE hunt unwinnable. Checked whenever the
    // merged result is published — not just on the publish transition —
    // because shrinking a live hunt's mission list (PUT …/missions) or
    // raising badgeTarget on one (PATCH) must clamp exactly like publishing
    // does. Computed from the merged state, so a status-only publish still
    // clamps against the stored missions.
    const merged = { ...(doc.data() as Record<string, unknown>), ...patch }
    if (merged.status === 'published') {
      const missions = Array.isArray(merged.missions) ? (merged.missions as Mission[]) : []
      const badgeTarget = typeof merged.badgeTarget === 'number' ? merged.badgeTarget : 0
      if (missions.length > 0 && badgeTarget > missions.length) {
        tx.update(ref, { badgeTarget: missions.length })
      }
    }

    return true
  })

  if (!applied) return null
  return getCampaign(slug, id)
}

export async function deleteCampaign(slug: string, id: string): Promise<boolean> {
  const ref = campaignsCol(slug).doc(id)
  if (!(await ref.get()).exists) return false
  await ref.delete()
  return true
}

/**
 * The fan-facing read for one org.
 *
 * An org with nothing published returns an explicit empty list — the fan hub
 * shows its empty state. (An unknown slug also lands here and gets the same
 * empty list; the client's `GET /t/:slug/tenant` 404 is what drives the
 * "no team here" screen, keeping this hot path at one Firestore query.)
 */
export async function getPublishedMissionList(slug: string): Promise<MissionList> {
  const snap = await campaignsCol(slug).where('status', '==', 'published').limit(1).get()

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

  // A Firestore error is intentionally NOT swallowed here — it propagates so
  // the route answers 500 and the client shows "couldn't load" rather than a
  // misleading "nothing published yet".
  return { campaignId: '', name: '', badgeTarget: 1, missions: [] }
}

/** Looks a mission up for verification — scoped to the org, so a campaignId
 *  from another tenant can never resolve here, and only in a PUBLISHED hunt:
 *  a draft's mission ids are never surfaced to a fan, so accepting captures
 *  (and the Gemini spend they cost) against one is pure abuse surface. */
export async function findMission(
  slug: string,
  campaignId: string,
  missionId: string,
): Promise<Mission | null> {
  const campaign = await getCampaign(slug, campaignId)
  if (!campaign || campaign.status !== 'published') return null
  return campaign.missions.find((m) => m.id === missionId) ?? null
}
