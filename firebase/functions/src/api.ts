import { onRequest } from 'firebase-functions/v2/https'
import * as logger from 'firebase-functions/logger'
import { ZodError } from 'zod'

import { applyCors } from './helpers/cors'
// The wire format lives in the `shared` workspace package, which the app
// imports too — one definition, parsed on both ends. esbuild inlines it
// into lib/index.js at build time. See docs/architecture.md § Shared contracts.
import { echoSchema, missionListSchema, SEED_CAMPAIGN } from 'shared'

// ── Secrets ───────────────────────────────────────────────────────────
// When you need a third-party key (an OCR provider, an SMS gateway),
// declare it as a secret rather than an env var so it never lands in a
// config file. Example, intentionally left commented out:
//
//   import { defineSecret } from 'firebase-functions/params'
//   const OCR_API_KEY = defineSecret('OCR_API_KEY')
//   ...then add `secrets: [OCR_API_KEY]` to the onRequest options below
//   and read it at call time with `OCR_API_KEY.value()`.
//
// Set it once with: firebase functions:secrets:set OCR_API_KEY

const VALID_ROUTES = ['GET /health', 'GET /missions', 'POST /echo']

/**
 * The entire HTTP API, as one v2 function with hand-rolled routing.
 *
 * No Express on purpose: every dependency here is parsed on every cold
 * start, and the routing table is small enough that a switch is clearer
 * than a framework.
 */
export const api = onRequest(
  { region: 'us-central1', maxInstances: 10 },
  async (req, res) => {
    if (applyCors(req, res)) return

    // Normalize: "/health", "/health/" and "" all resolve the same way.
    const path = (req.path || '/').replace(/\/+$/, '') || '/'
    const route = `${req.method} ${path}`

    logger.info('request', { method: req.method, path })

    try {
      // ── GET /health ───────────────────────────────────────────────
      // Liveness probe. AboutPage.vue calls this to prove the whole
      // app -> emulator path works on a fresh clone.
      if (route === 'GET /health') {
        res.status(200).json({ ok: true, ts: new Date().toISOString() })
        return
      }

      // ── GET /missions ─────────────────────────────────────────────
      // SEAM: returns the seeded campaign from the shared package.
      // Replace with a Firestore read; `missionListSchema` is the
      // contract and should not change.
      if (route === 'GET /missions') {
        const payload = missionListSchema.parse(SEED_CAMPAIGN)
        res.status(200).json(payload)
        return
      }

      // ── POST /echo ────────────────────────────────────────────────
      // Reference endpoint for request validation.
      if (route === 'POST /echo') {
        const parsed = echoSchema.parse(req.body)
        res.status(200).json({ success: true, echoed: parsed })
        return
      }

      // ── 404 ───────────────────────────────────────────────────────
      logger.warn('unknown route', { route })
      res.status(404).json({
        error: 'Not found',
        route,
        validRoutes: VALID_ROUTES,
      })
    } catch (err) {
      if (err instanceof ZodError) {
        // flatten() gives the client field-level errors it can render
        // next to the offending input.
        logger.warn('validation failed', { route, issues: err.issues })
        res.status(400).json({ error: 'Validation failed', details: err.flatten() })
        return
      }

      logger.error('unhandled error', { route, err })
      res.status(500).json({ error: 'Internal error' })
    }
  },
)
