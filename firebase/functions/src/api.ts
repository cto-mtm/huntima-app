import { onRequest } from 'firebase-functions/v2/https'
import * as logger from 'firebase-functions/logger'
import { z, ZodError } from 'zod'

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
import { verifyCapture } from './helpers/vision'
import { getTenant, putTenant } from './helpers/tenant'
// The wire format lives in the `shared` workspace package, which the app
// imports too — one definition, parsed on both ends. esbuild inlines it
// into lib/index.js at build time. See docs/architecture.md § Shared contracts.
import {
  campaignInputSchema,
  echoSchema,
  missionSchema,
  verifyCaptureSchema,
  tenantConfigSchema,
} from 'shared'

// ── Secrets ───────────────────────────────────────────────────────────
// GEMINI_API_KEY is read in helpers/vision.ts. Locally it comes from
// firebase/functions/.env; in production promote it to a real secret:
//
//   firebase functions:secrets:set GEMINI_API_KEY
//
// and add `secrets: ['GEMINI_API_KEY']` to the options below. It must never
// reach the client bundle — a key in a bundle is a key someone else spends.

const VALID_ROUTES = [
  'GET /health',
  'GET /missions',
  'POST /echo',
  'POST /verify-capture',
  'GET /tenant',
  'PUT /admin/tenant',
  'GET /admin/whoami',
  'GET /admin/campaigns',
  'POST /admin/campaigns',
  'GET /admin/campaigns/:id',
  'PATCH /admin/campaigns/:id',
  'DELETE /admin/campaigns/:id',
  'PUT /admin/campaigns/:id/missions',
]

// Demo credentials for the Auth emulator ONLY. These never reach a deployed
// function: the seed route is gated on isEmulator.
const DEMO_ADMIN_EMAIL = 'admin@demo.local'
const DEMO_ADMIN_PASSWORD = 'demo1234'

const missionListPayloadSchema = z.object({ missions: z.array(missionSchema).max(50) })

/**
 * The entire HTTP API, as one v2 function with hand-rolled routing.
 *
 * No Express on purpose: every dependency here is parsed on every cold start,
 * and the routing table is small enough that segment matching is clearer than
 * a framework.
 */
export const api = onRequest(
  { region: 'us-central1', maxInstances: 10, memory: '512MiB', timeoutSeconds: 60 },
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

    try {
      // ── Public ────────────────────────────────────────────────────
      if (route === 'GET /health') {
        res.status(200).json({ ok: true, ts: new Date().toISOString() })
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
        const input = verifyCaptureSchema.parse(req.body)
        const mission = await findMission(input.campaignId, input.missionId)

        if (!mission) {
          res.status(404).json({ error: 'Unknown mission' })
          return
        }

        const result = await verifyCapture(mission, input.imageBase64, input.mimeType)
        logger.info('capture verified', {
          missionId: mission.id,
          match: result.match,
          confidence: result.confidence,
          stubbed: result.stubbed,
        })
        res.status(200).json(result)
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
