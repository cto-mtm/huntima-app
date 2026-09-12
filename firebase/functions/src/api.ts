import { onRequest } from 'firebase-functions/v2/https'
import * as logger from 'firebase-functions/logger'
import { ZodError } from 'zod'

import { applyCors } from './helpers/cors'
import { isEmulator, seedDemoAdmin, verifyRequest, type AuthedUser } from './helpers/auth'
import {
  createCampaign,
  deleteCampaign,
  findMission,
  getCampaign,
  getPublishedMissionList,
  listCampaigns,
  updateCampaign,
} from './helpers/campaigns'
import { verifyCapture, isVerificationLive, VERIFICATION_MODEL } from './helpers/vision'
import { getTenant, putTenant } from './helpers/tenant'
import { getCampaignStats, recordCapture, recordFanEvent } from './helpers/analytics'
import { getFanProgress, putFanProgress } from './helpers/fanProgress'
import { callerIp, rateLimit } from './helpers/rateLimit'
// The wire format lives in the `shared` workspace package, which the app
// imports too — one definition, parsed on both ends. esbuild inlines it
// into lib/index.js at build time. See docs/architecture.md § Shared contracts.
import {
  campaignInputSchema,
  campaignEventSchema,
  echoSchema,
  fanProgressSchema,
  verifyCaptureSchema,
  verifyResultSchema,
  missionListPayloadSchema,
  tenantConfigSchema,
} from 'shared'

// ── Secrets ───────────────────────────────────────────────────────────
// GEMINI_API_KEY is read in helpers/vision.ts and DECLARED on the function
// below, so in production Cloud Run injects it from Secret Manager. Create it
// once before deploying:
//
//   firebase functions:secrets:set GEMINI_API_KEY
//
// Locally the same name comes from firebase/functions/.env (or .secret.local);
// with no key set, verification returns the stub verdict. It must never reach
// the client bundle — a key in a bundle is a key someone else spends.

const VALID_ROUTES = [
  'GET /health',
  'GET /missions',
  'POST /echo',
  'POST /verify-capture',
  'POST /campaigns/:id/events',
  'GET /me/progress',
  'PUT /me/progress',
  'GET /tenant',
  'PUT /admin/tenant',
  'GET /admin/whoami',
  'GET /admin/campaigns',
  'POST /admin/campaigns',
  'GET /admin/campaigns/:id',
  'PATCH /admin/campaigns/:id',
  'DELETE /admin/campaigns/:id',
  'PUT /admin/campaigns/:id/missions',
  'GET /admin/campaigns/:id/stats',
]

// Demo credentials for the Auth emulator ONLY. These never reach a deployed
// function: the seed route is gated on isEmulator.
const DEMO_ADMIN_EMAIL = 'admin@demo.local'
const DEMO_ADMIN_PASSWORD = 'demo1234'

/**
 * The entire HTTP API, as one v2 function with hand-rolled routing.
 *
 * No Express on purpose: every dependency here is parsed on every cold start,
 * and the routing table is small enough that segment matching is clearer than
 * a framework.
 */
export const api = onRequest(
  {
    region: 'us-central1',
    maxInstances: 10,
    memory: '512MiB',
    timeoutSeconds: 60,
    // Injected from Secret Manager in production; from .env locally.
    secrets: ['GEMINI_API_KEY'],
  },
  async (req, res) => {
    if (applyCors(req, res)) return

    const path = (req.path || '/').replace(/\/+$/, '') || '/'
    const segments = path.split('/').filter(Boolean)
    const route = `${req.method} ${path}`

    logger.info('request', { method: req.method, path })

    /**
     * Resolves the caller and enforces the `admin` custom claim.
     *
     * This is the REAL gate. The router guard in the app only decides what UI
     * to draw; a client that forces its way to /admin gets a dashboard whose
     * every privileged call lands here and is refused.
     */
    async function requireStaff(): Promise<AuthedUser | null> {
      const user = await verifyRequest(req.headers.authorization)
      if (!user) {
        res.status(401).json({ error: 'Unauthenticated' })
        return null
      }
      if (!user.isAdmin) {
        res.status(403).json({ error: 'Not an admin' })
        return null
      }
      return user
    }

    /**
     * Resolves ANY authenticated caller — no admin claim required. Used by the
     * fan-progress endpoints, which act only on the caller's OWN document
     * (keyed by their verified uid), so a signed-in fan is enough. Guests have
     * no token and are refused; their progress stays device-local by design.
     */
    async function requireAuth(): Promise<AuthedUser | null> {
      const user = await verifyRequest(req.headers.authorization)
      if (!user) {
        res.status(401).json({ error: 'Unauthenticated' })
        return null
      }
      return user
    }

    try {
      // ── Public ────────────────────────────────────────────────────
      if (route === 'GET /health') {
        // `verificationLive` tells ops whether a real vision key is configured.
        // When false, every capture auto-passes via the lenient stub — expected
        // locally, a silent honor-system in production. `model` aids a quick
        // "is the pinned model still valid" check. Neither leaks the key.
        res.status(200).json({
          ok: true,
          ts: new Date().toISOString(),
          verificationLive: isVerificationLive(),
          model: VERIFICATION_MODEL,
        })
        return
      }

      // Served from Firestore, falling back to the built-in demo campaign so
      // a fresh install never shows an empty app to a family that just
      // scanned a QR code.
      if (route === 'GET /missions') {
        res.status(200).json(await getPublishedMissionList())
        return
      }

      // Branding, read by every fan on first paint. Public because fans are
      // anonymous and a club's logo is not a secret.
      if (route === 'GET /tenant') {
        res.status(200).json(await getTenant())
        return
      }

      if (route === 'POST /echo') {
        res.status(200).json({ success: true, echoed: echoSchema.parse(req.body) })
        return
      }

      // ── Capture verification ──────────────────────────────────────
      // The verdict is server-authoritative on purpose: the client used to
      // award its own badges, which is the same as letting it mint prizes.
      // The image is never persisted — see storage.rules.
      if (route === 'POST /verify-capture') {
        // Cost guard: this endpoint is unauthenticated (fans are anonymous)
        // and every call hits a PAID vision model on a ~1 MB image. Without a
        // ceiling, anyone holding the public campaign/mission ids can drive
        // unbounded model spend. Limit per caller IP; fail-open so a limiter
        // outage never costs a real fan their capture. See helpers/rateLimit.
        const gate = await rateLimit({
          bucket: 'verify-capture',
          key: callerIp(req.headers as Record<string, unknown>, req.ip),
          limit: 30,
          windowSeconds: 60,
        })
        if (!gate.allowed) {
          logger.warn('verify-capture rate limited', { ip: req.ip })
          res.set('Retry-After', String(gate.retryAfterSeconds))
          res.status(429).json({ error: 'Too many requests. Please slow down.' })
          return
        }

        const input = verifyCaptureSchema.parse(req.body)
        const mission = await findMission(input.campaignId, input.missionId)

        if (!mission) {
          res.status(404).json({ error: 'Unknown mission' })
          return
        }

        // Parse what we are about to SEND, not just what we received. The
        // verdict decides whether a prize is handed over, and it is assembled
        // from a model response we do not control.
        const result = verifyResultSchema.parse(
          await verifyCapture(mission, input.imageBase64, input.mimeType),
        )
        logger.info('capture verified', {
          missionId: mission.id,
          match: result.match,
          confidence: result.confidence,
          stubbed: result.stubbed,
        })

        // Aggregate analytics. Only a persisted, published hunt has a real
        // campaign id; skip the stats write when there is none. A stats write
        // must never fail the verdict a fan is waiting on — swallow it and let
        // the badge stand.
        if (input.campaignId) {
          try {
            await recordCapture(input.campaignId, result.match, new Date())
          } catch (err) {
            logger.warn('stats write failed', { campaignId: input.campaignId, err })
          }
        }

        res.status(200).json(result)
        return
      }

      // Fan-reported analytics events (started a hunt, finished it). Public
      // because fans are anonymous — the same reason the claim code is
      // forgeable today. It only ever increments an aggregate counter, so the
      // worst an abusive caller does is inflate a number; closing that is part
      // of the anonymous-auth seam. Only a real, persisted hunt gets stats.
      if (segments[0] === 'campaigns' && segments[2] === 'events' && req.method === 'POST') {
        const campaignId = segments[1]
        // Cheap counter, but still an unauthenticated write — cap it so it
        // can't be spun into a write-amplification bill. Generous: a real fan
        // fires this a handful of times per hunt.
        const gate = await rateLimit({
          bucket: 'campaign-events',
          key: callerIp(req.headers as Record<string, unknown>, req.ip),
          limit: 60,
          windowSeconds: 60,
        })
        if (!gate.allowed) {
          res.set('Retry-After', String(gate.retryAfterSeconds))
          res.status(429).json({ error: 'Too many requests.' })
          return
        }
        const { kind } = campaignEventSchema.parse(req.body)
        if (campaignId) {
          try {
            await recordFanEvent(campaignId, kind)
          } catch (err) {
            logger.warn('fan event write failed', { campaignId, kind, err })
          }
        }
        res.status(204).send('')
        return
      }

      // ── Fan progress (cross-device continuity) ────────────────────
      // A signed-in fan's OWN progress, stored under their verified uid so
      // their trophies follow them to a new phone. This is continuity, NOT a
      // trusted ledger: the server stores what the client claims, so it must
      // never be the basis for handing over a prize without staff
      // verification — the same forgeable-claim-code caveat as today (see
      // docs/architecture.md § Seams). The client merges the server copy with
      // local state before PUTting, so this is a whole-document replace.
      if (route === 'GET /me/progress') {
        const user = await requireAuth()
        if (!user) return
        res.status(200).json({ progress: await getFanProgress(user.uid) })
        return
      }

      if (route === 'PUT /me/progress') {
        const user = await requireAuth()
        if (!user) return
        const progress = fanProgressSchema.parse(req.body)
        await putFanProgress(user.uid, progress)
        res.status(200).json({ progress })
        return
      }

      // ── Staff ─────────────────────────────────────────────────────
      // Whole-document replace: branding is edited as one coherent look, and
      // a partial write could leave a club with someone else's accent color.
      if (route === 'PUT /admin/tenant') {
        const user = await requireStaff()
        if (!user) return
        const config = tenantConfigSchema.parse(req.body)
        logger.info('tenant updated', { by: user.email, teamName: config.teamName })
        res.status(200).json(await putTenant(config))
        return
      }

      if (route === 'GET /admin/whoami') {
        const user = await requireStaff()
        if (!user) return
        res.status(200).json({ uid: user.uid, email: user.email, isAdmin: true })
        return
      }

      if (segments[0] === 'admin' && segments[1] === 'campaigns') {
        const user = await requireStaff()
        if (!user) return

        const id = segments[2]

        if (!id) {
          if (req.method === 'GET') {
            res.status(200).json({ campaigns: await listCampaigns() })
            return
          }
          if (req.method === 'POST') {
            const created = await createCampaign(campaignInputSchema.parse(req.body))
            res.status(201).json(created)
            return
          }
        } else if (segments[3] === 'missions') {
          // Whole-list replace rather than per-mission routes: the editor
          // reorders and edits together, and a hunt a fan might be mid-way
          // through must never be half-updated.
          if (req.method === 'PUT') {
            const { missions } = missionListPayloadSchema.parse(req.body)
            const updated = await updateCampaign(id, { missions })
            if (!updated) {
              res.status(404).json({ error: 'Unknown campaign' })
              return
            }
            res.status(200).json(updated)
            return
          }
        } else if (segments[3] === 'stats') {
          // Aggregate counters for this hunt. Returns zeroes for a hunt nobody
          // has played yet rather than 404 — an empty dashboard is a real
          // answer, and the stats doc is created lazily on the first event.
          if (req.method === 'GET') {
            res.status(200).json(await getCampaignStats(id))
            return
          }
        } else if (!segments[3]) {
          if (req.method === 'GET') {
            const campaign = await getCampaign(id)
            if (!campaign) {
              res.status(404).json({ error: 'Unknown campaign' })
              return
            }
            res.status(200).json(campaign)
            return
          }
          if (req.method === 'PATCH') {
            const patch = campaignInputSchema.partial().parse(req.body)
            const updated = await updateCampaign(id, patch)
            if (!updated) {
              res.status(404).json({ error: 'Unknown campaign' })
              return
            }
            res.status(200).json(updated)
            return
          }
          if (req.method === 'DELETE') {
            const ok = await deleteCampaign(id)
            res.status(ok ? 204 : 404).send('')
            return
          }
        }
      }

      // ── Emulator only ─────────────────────────────────────────────
      // The Auth emulator starts empty and custom claims cannot be set from
      // the client SDK, so without this a fresh clone has no route into the
      // admin dashboard at all.
      if (route === 'POST /dev/seed-admin') {
        if (!isEmulator) {
          logger.warn('seed-admin attempted outside the emulator')
          res.status(404).json({ error: 'Not found' })
          return
        }
        const seeded = await seedDemoAdmin(DEMO_ADMIN_EMAIL, DEMO_ADMIN_PASSWORD)
        res.status(200).json({ ...seeded, email: DEMO_ADMIN_EMAIL, password: DEMO_ADMIN_PASSWORD })
        return
      }

      logger.warn('unknown route', { route })
      res.status(404).json({ error: 'Not found', route, validRoutes: VALID_ROUTES })
    } catch (err) {
      if (err instanceof ZodError) {
        logger.warn('validation failed', { route, issues: err.issues })
        res.status(400).json({ error: 'Validation failed', details: err.flatten() })
        return
      }

      logger.error('unhandled error', { route, err })
      res.status(500).json({ error: 'Internal error' })
    }
  },
)
