#!/usr/bin/env node
/**
 * Seeds the local emulator with everything needed to click around:
 * a staff account, club branding, and a published hunt.
 *
 *   npm run seed          (from the repo root)
 *
 * Idempotent — run it after every emulator restart. The Auth and Firestore
 * emulators start empty and do not persist, so this is the fastest path from
 * a cold start to a working app.
 *
 * It drives the REAL admin API with a real ID token rather than writing to
 * Firestore directly, so a broken auth gate or a schema change fails the seed
 * instead of silently producing data the app cannot read.
 *
 * Dependency-free on purpose: Node 18+ has fetch, and a seed script that
 * needs its own `npm install` is a seed script people stop running.
 */

const API = process.env.SEED_API_URL ?? 'http://127.0.0.1:5001/demo-app/us-central1/api'
const AUTH = process.env.SEED_AUTH_URL ?? 'http://127.0.0.1:9099'
const API_KEY = 'demo-api-key'

function die(message, hint) {
  console.error(`\n  x ${message}`)
  if (hint) console.error(`    ${hint}`)
  console.error('')
  process.exit(1)
}

async function call(path, options = {}) {
  let res
  try {
    res = await fetch(`${API}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    })
  } catch {
    die(
      `Could not reach the functions emulator at ${API}`,
      'Start it first:  npm run emulators',
    )
  }
  if (!res.ok) die(`${options.method ?? 'GET'} ${path} failed: HTTP ${res.status}`, await res.text())
  return res.status === 204 ? null : res.json()
}

// ── 1. Staff account ──────────────────────────────────────────────────
// Custom claims cannot be set from a client SDK, so the function does it.
const admin = await call('/dev/seed-admin', { method: 'POST', body: '{}' })

const signIn = await fetch(
  `${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: admin.email,
      password: admin.password,
      returnSecureToken: true,
    }),
  },
).catch(() => die(`Could not reach the Auth emulator at ${AUTH}`, 'Is it running?'))

const { idToken } = await signIn.json()
if (!idToken) die('Signed in but got no ID token.', 'Is the Auth emulator healthy?')

const auth = { Authorization: `Bearer ${idToken}` }

// ── 2. Club branding ──────────────────────────────────────────────────
// Colors are placeholders chosen to read well and pass contrast, not an
// attempt to reproduce any club's official brand. Set the real values in
// the Branding tab.
const tenant = await call('/admin/tenant', {
  method: 'PUT',
  headers: auth,
  body: JSON.stringify({
    teamName: 'Louisville Bats',
    prizeLocation: 'the Main Team Store',
    badgeTarget: 5,
    timezone: 'America/New_York',
    brandBase: '#14284b',
    accentBase: '#c8102e',
    logoUrl: null,
    avatars: [],
  }),
})

// ── 3. A published hunt ───────────────────────────────────────────────
// Staff-authored copy is literal text, never i18n keys — it is
// user-generated content. See docs/i18n.md.
const MISSIONS = [
  ['Bronze at the Gate', 'Find the statue outside the main gate and frame the face.', 'photo', '#14284b'],
  ['Big Cup Energy', 'The oversized soda cup at the concourse stand. You cannot miss it.', 'photo', '#c8102e'],
  ['Jersey Wall', 'Inside the team store, find the wall of hanging jerseys.', 'photo', '#4f8a63'],
  ['Down the Line', 'Stand where you can see a whole foul pole, top to bottom.', 'photo', '#8b6db3'],
  ['Spot Number 22', 'Zoom in on the field and frame the number 22 on a jersey.', 'spyglass', '#d09a2c'],
  ['Mascot Hunt', 'The mascot is working the crowd. Catch it in the box.', 'spyglass', '#2f8f9d'],
]

const existing = await call('/admin/campaigns', { headers: auth })
const SEED_NAME = 'Opening Night Safari'
let hunt = existing.campaigns.find((c) => c.name === SEED_NAME)

if (!hunt) {
  hunt = await call('/admin/campaigns', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ name: SEED_NAME, status: 'draft', badgeTarget: 5 }),
  })
}

await call(`/admin/campaigns/${hunt.id}/missions`, {
  method: 'PUT',
  headers: auth,
  body: JSON.stringify({
    missions: MISSIONS.map(([title, hint, kind, color], order) => ({
      id: `seed-${order + 1}`,
      kind,
      title: { text: title },
      hint: { text: hint },
      color,
      targetImageUrl: null,
      order,
    })),
  }),
})

await call(`/admin/campaigns/${hunt.id}`, {
  method: 'PATCH',
  headers: auth,
  body: JSON.stringify({ status: 'published' }),
})

// ── Done ──────────────────────────────────────────────────────────────
console.log(`
  Seeded.

    staff     ${admin.email} / ${admin.password}
    club      ${tenant.teamName}
    hunt      ${SEED_NAME} (published, ${MISSIONS.length} missions)

  Open the app and tap "Continue as guest", or sign in at /staff-login.
  No target photos are seeded — upload them per mission under Hunts.
`)
