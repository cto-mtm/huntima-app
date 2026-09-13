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
import { createOrg, getTenant, putTenant } from './helpers/tenant'
import { addMember, getMembership, listMembers, listOrgs, uidByEmail } from './helpers/members'
import { getCampaignStats, recordCapture, recordFanEvent } from './helpers/analytics'
import { getFanProgress, putFanProgress } from './helpers/fanProgress'
import { callerIp, rateLimit } from './helpers/rateLimit'
// The wire format lives in the `shared` workspace package, which the app
// imports too — one definition, parsed on both ends. esbuild inlines it
// into lib/index.js at build time. See docs/architecture.md § Shared contracts.
import {
  campaignInputSchema,
  campaignEventSchema,
  createOrgSchema,
  echoSchema,
  fanProgressSchema,
  orgRoleSchema,
  tenantSlugSchema,
  verifyCaptureSchema,
  verifyResultSchema,
  missionListPayloadSchema,
  tenantConfigSchema,
} from 'shared'
import { z } from 'zod'

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
  'POST /echo',
  'GET /me/progress',
  'PUT /me/progress',
  'GET /me/orgs',
  'POST /orgs',
  'GET /t/:slug/tenant',
  'GET /t/:slug/missions',
  'POST /t/:slug/verify-capture',
  'POST /t/:slug/campaigns/:id/events',
  'PUT /t/:slug/admin/tenant',
  'GET /t/:slug/admin/whoami',
  'GET /t/:slug/admin/members',
  'POST /t/:slug/admin/members',
  'GET /t/:slug/admin/campaigns',
  'POST /t/:slug/admin/campaigns',
  'GET /t/:slug/admin/campaigns/:id',
  'PATCH /t/:slug/admin/campaigns/:id',
  'DELETE /t/:slug/admin/campaigns/:id',
  'PUT /t/:slug/admin/campaigns/:id/missions',
  'GET /t/:slug/admin/campaigns/:id/stats',
]

// Demo credentials for the Auth emulator ONLY. These never reach a deployed
// function: the seed route is gated on isEmulator.
const DEMO_ADMIN_EMAIL = 'admin@demo.local'
const DEMO_ADMIN_PASSWORD = 'demo1234'

/** Body of `POST /t/:slug/admin/members`. */
const addMemberSchema = z.object({
  email: z.string().email().max(200),
  role: orgRoleSchema,
})

/**
 * Per-tenant daily verification budget. This is the platform's cost ceiling
 * per org — one org's viral hunt must not be able to drive unbounded vision
 * spend for everyone. In Phase 2 the billing tier sets this number; until
 * then, one generous constant covers a 5k-player event day with retries.
 */
const TENANT_VERIFY_DAILY_LIMIT = 50_000

/**
 * The entire HTTP API, as one v2 function with hand-rolled routing.
 *
 * No Express on purpose: every dependency here is parsed on every cold start,
 * and the routing table is small enough that segment matching is clearer than
 * a framework.
 *
 * Multi-tenant layout: public fan routes and org consoles live under
 * `/t/:slug/…`. The literal `t` segment keeps the router unambiguous — a
 * bare `/:slug/…` would collide with every future top-level route. The app's
 * pretty URLs (`huntima.app/louisville-bats`) are a client concern; the
 * wire format always carries the prefix.
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
     * Resolves the caller and enforces the PLATFORM OPERATOR claim (`admin`).
     * Operators are us — support/ops — never a customer. Org access goes
     * through `requireMember` below.
     */
    async function requireOperator(): Promise<AuthedUser | null> {
      const user = await verifyRequest(req.headers.authorization)
      if (!user) {
        res.status(401).json({ error: 'Unauthenticated' })
        return null
      }
      if (!user.isAdmin) {
        res.status(403).json({ error: 'Not a platform operator' })
        return null
      }
      return user
    }

    /**
     * Resolves ANY authenticated caller — no claim required. Used by the
     * fan-progress endpoints (act only on the caller's OWN document) and the
     * org list. Guests have no token and are refused; their progress stays
     * device-local by design.
     */
    async function requireAuth(): Promise<AuthedUser | null> {
      const user = await verifyRequest(req.headers.authorization)
      if (!user) {
        res.status(401).json({ error: 'Unauthenticated' })
        return null
      }
      return user
    }

    /**
     * The org-console gate: a membership document in `tenants/{slug}/members`
     * — or the operator claim, which bypasses membership everywhere. This is
     * the REAL gate; the app's router guard only decides what UI to draw.
     */
    async function requireMember(
      slug: string,
    ): Promise<{ user: AuthedUser; role: 'owner' | 'editor' | 'operator' } | null> {
      const user = await verifyRequest(req.headers.authorization)
      if (!user) {
        res.status(401).json({ error: 'Unauthenticated' })
        return null
      }
      if (user.isAdmin) return { user, role: 'operator' }
      const role = await getMembership(slug, user.uid)
      if (!role) {
        res.status(403).json({ error: 'Not a member of this organization' })
        return null
      }
      return { user, role }
    }

    try {
      // ── Public, tenant-agnostic ───────────────────────────────────
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

      if (route === 'POST /echo') {
        res.status(200).json({ success: true, echoed: echoSchema.parse(req.body) })
        return
      }

      // ── Fan progress (cross-device continuity) ────────────────────
      // A signed-in fan's OWN progress, stored under their verified uid so
      // their trophies follow them to a new phone. Continuity, NOT a trusted
      // ledger: the server stores what the client claims (see
      // docs/architecture.md § Seams). Whole-document replace; the client
      // merges before PUTting.
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

      // The orgs this account can open — drives the org picker.
      if (route === 'GET /me/orgs') {
        const user = await requireAuth()
        if (!user) return
        res.status(200).json({ orgs: await listOrgs(user.uid, user.isAdmin) })
        return
      }

      // ── Org creation ──────────────────────────────────────────────
      // Operator-gated in Phase 1 (venues are onboarded by hand). Phase 2
      // self-serve is exactly this gate flipping to requireAuth — slug
      // validation, reservation and the owner membership are already here.
      if (route === 'POST /orgs') {
        const user = await requireOperator()
        if (!user) return
        const input = createOrgSchema.parse(req.body)
        const result = await createOrg(input.slug, input.teamName, user.uid)
        if (result === 'exists') {
          res.status(409).json({ error: 'That name is taken' })
          return
        }
        logger.info('org created', { slug: input.slug, by: user.email })
        res.status(201).json({ slug: input.slug, teamName: input.teamName })
        return
      }

      // ── Tenant-scoped: /t/:slug/… ─────────────────────────────────
      if (segments[0] === 't' && segments.length >= 3) {
        const slugParse = tenantSlugSchema.safeParse(segments[1])
        if (!slugParse.success) {
          res.status(404).json({ error: 'Unknown organization' })
          return
        }
        const slug = slugParse.data
        const rest = segments.slice(2)

        // Branding, read by every fan on first paint. Public because fans
        // are anonymous and a club's logo is not a secret. 404 for an
        // unknown slug — never a phantom default club.
        if (rest[0] === 'tenant' && rest.length === 1 && req.method === 'GET') {
          const tenant = await getTenant(slug)
          if (!tenant) {
            res.status(404).json({ error: 'Unknown organization' })
            return
          }
          res.status(200).json(tenant)
          return
        }

        // The org's published hunt (or the explicit empty list).
        if (rest[0] === 'missions' && rest.length === 1 && req.method === 'GET') {
          res.status(200).json(await getPublishedMissionList(slug))
          return
        }

        // ── Capture verification ────────────────────────────────────
        // Server-authoritative on purpose. The image is never persisted.
        if (rest[0] === 'verify-capture' && rest.length === 1 && req.method === 'POST') {
          // Cost guards, two axes. Per-IP: one client cannot loop us into
          // model spend. Per-tenant: one org's viral hunt cannot consume the
          // platform's wallet — this bucket is also where a billing tier
          // will plug in its number. Both fail open (see helpers/rateLimit):
          // a fan must never lose a capture to our bookkeeping.
          const ipGate = await rateLimit({
            bucket: 'verify-capture',
            key: callerIp(req.headers as Record<string, unknown>, req.ip),
            limit: 30,
            windowSeconds: 60,
          })
          if (!ipGate.allowed) {
            logger.warn('verify-capture rate limited', { ip: req.ip })
            res.set('Retry-After', String(ipGate.retryAfterSeconds))
            res.status(429).json({ error: 'Too many requests. Please slow down.' })
            return
          }

          const tenantGate = await rateLimit({
            bucket: 'verify-capture-tenant',
            key: slug,
            limit: TENANT_VERIFY_DAILY_LIMIT,
            windowSeconds: 86_400,
          })
          if (!tenantGate.allowed) {
            logger.warn('verify-capture tenant budget exhausted', { slug })
            res.set('Retry-After', String(tenantGate.retryAfterSeconds))
            res.status(429).json({ error: 'This hunt is over its daily limit.' })
            return
          }

          const input = verifyCaptureSchema.parse(req.body)
          // Scoped lookup: a campaignId from another org can never resolve.
          const mission = await findMission(slug, input.campaignId, input.missionId)

          if (!mission) {
            res.status(404).json({ error: 'Unknown mission' })
            return
          }

          // Parse what we are about to SEND, not just what we received. The
          // verdict decides whether a prize is handed over, and it is
          // assembled from a model response we do not control.
          const result = verifyResultSchema.parse(
            await verifyCapture(mission, input.imageBase64, input.mimeType),
          )
          logger.info('capture verified', {
            slug,
            missionId: mission.id,
            match: result.match,
            confidence: result.confidence,
            stubbed: result.stubbed,
          })

          // Aggregate analytics. A stats write must never fail the verdict a
          // fan is waiting on — swallow it and let the badge stand.
          if (input.campaignId) {
            try {
              await recordCapture(slug, input.campaignId, result.match, new Date())
            } catch (err) {
              logger.warn('stats write failed', { slug, campaignId: input.campaignId, err })
            }
          }

          res.status(200).json(result)
          return
        }

        // Fan-reported analytics events (started a hunt, finished it).
        // Public because fans are anonymous; it only ever increments an
        // aggregate counter, so the worst an abusive caller does is inflate
        // a number.
        if (rest[0] === 'campaigns' && rest[2] === 'events' && rest.length === 3 && req.method === 'POST') {
          const campaignId = rest[1]
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
              await recordFanEvent(slug, campaignId, kind)
            } catch (err) {
              logger.warn('fan event write failed', { slug, campaignId, kind, err })
            }
          }
          res.status(204).send('')
          return
        }

        // ── Org console: /t/:slug/admin/… ───────────────────────────
        if (rest[0] === 'admin') {
          const member = await requireMember(slug)
          if (!member) return
          const { user, role } = member

          // Whole-document branding replace: branding is edited as one
          // coherent look, and a partial write could leave a club with
          // someone else's accent color.
          if (rest[1] === 'tenant' && rest.length === 2 && req.method === 'PUT') {
            const config = tenantConfigSchema.parse(req.body)
            const saved = await putTenant(slug, config)
            if (!saved) {
              res.status(404).json({ error: 'Unknown organization' })
              return
            }
            logger.info('tenant updated', { slug, by: user.email, teamName: config.teamName })
            res.status(200).json(saved)
            return
          }

          if (rest[1] === 'whoami' && rest.length === 2 && req.method === 'GET') {
            res.status(200).json({ uid: user.uid, email: user.email, role })
            return
          }

          // Member management: owners (and operators) only. This is how a
          // venue's second staff account gets in the door.
          if (rest[1] === 'members' && rest.length === 2) {
            if (req.method === 'GET') {
              res.status(200).json({ members: await listMembers(slug) })
              return
            }
            if (req.method === 'POST') {
              if (role !== 'owner' && role !== 'operator') {
                res.status(403).json({ error: 'Only an owner can manage members' })
                return
              }
              const input = addMemberSchema.parse(req.body)
              const uid = await uidByEmail(input.email)
              if (!uid) {
                res.status(404).json({ error: 'No account with that email' })
                return
              }
              await addMember(slug, uid, input.role, user.uid)
              res.status(201).json({ uid, role: input.role })
              return
            }
          }

          if (rest[1] === 'campaigns') {
            const id = rest[2]

            if (!id) {
              if (req.method === 'GET') {
                res.status(200).json({ campaigns: await listCampaigns(slug) })
                return
              }
              if (req.method === 'POST') {
                const created = await createCampaign(slug, campaignInputSchema.parse(req.body))
                res.status(201).json(created)
                return
              }
            } else if (rest[3] === 'missions') {
              // Whole-list replace rather than per-mission routes: the editor
              // reorders and edits together, and a hunt a fan might be
              // mid-way through must never be half-updated.
              if (req.method === 'PUT') {
                const { missions } = missionListPayloadSchema.parse(req.body)
                const updated = await updateCampaign(slug, id, { missions })
                if (!updated) {
                  res.status(404).json({ error: 'Unknown campaign' })
                  return
                }
                res.status(200).json(updated)
                return
              }
            } else if (rest[3] === 'stats') {
              // Aggregate counters. Zeroes for an unplayed hunt rather than
              // 404 — an empty dashboard is a real answer.
              if (req.method === 'GET') {
                res.status(200).json(await getCampaignStats(slug, id))
                return
              }
            } else if (!rest[3]) {
              if (req.method === 'GET') {
                const campaign = await getCampaign(slug, id)
                if (!campaign) {
                  res.status(404).json({ error: 'Unknown campaign' })
                  return
                }
                res.status(200).json(campaign)
                return
              }
              if (req.method === 'PATCH') {
                const patch = campaignInputSchema.partial().parse(req.body)
                // Firestore's update() rejects an empty write with a 500-ish
                // SDK error; an empty patch is a caller mistake, say so.
                if (Object.keys(patch).length === 0) {
                  res.status(400).json({ error: 'Empty patch' })
                  return
                }
                const updated = await updateCampaign(slug, id, patch)
                if (!updated) {
                  res.status(404).json({ error: 'Unknown campaign' })
                  return
                }
                res.status(200).json(updated)
                return
              }
              if (req.method === 'DELETE') {
                const ok = await deleteCampaign(slug, id)
                res.status(ok ? 204 : 404).send('')
                return
              }
            }
          }
        }
      }

      // ── Emulator only ─────────────────────────────────────────────
      // The Auth emulator starts empty and custom claims cannot be set from
      // the client SDK, so without this a fresh clone has no route into any
      // org console at all. The account it creates carries the OPERATOR
      // claim, which passes every membership gate — seed.mjs then creates
      // the demo orgs through the real API.
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
