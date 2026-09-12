#!/usr/bin/env node
/**
 * Seeds the local emulator with the demo staff account.
 *
 *   npm run seed          (from the repo root)
 *
 * Equivalent to clicking "Create demo admin" in the app, for when you want
 * it from a terminal — a fresh clone, a reset emulator, or CI.
 *
 * Deliberately dependency-free: Node 18+ has fetch, and a seed script that
 * needs its own `npm install` is a seed script people stop running.
 *
 * The heavy lifting is server-side in functions/src/helpers/auth.ts, because
 * custom claims cannot be set from a client SDK. This only calls the route,
 * which is itself gated on FUNCTIONS_EMULATOR.
 */

const BASE =
  process.env.SEED_API_URL ?? 'http://127.0.0.1:5001/demo-app/us-central1/api'

const url = `${BASE}/dev/seed-admin`

function die(message, hint) {
  console.error(`\n  ✖ ${message}`)
  if (hint) console.error(`    ${hint}`)
  console.error('')
  process.exit(1)
}

let res
try {
  res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  })
} catch (err) {
  die(
    `Could not reach the functions emulator at ${BASE}`,
    'Start it first:  npm run emulators',
  )
}

if (res.status === 404) {
  die(
    'The seed route refused the request (404).',
    'That route only exists in the emulator. You are pointed at a deployed API.',
  )
}

if (!res.ok) {
  die(`Seed failed: HTTP ${res.status}`, await res.text())
}

const admin = await res.json()

console.log(`
  ✔ Demo staff account ready

    email     ${admin.email}
    password  ${admin.password}
    uid       ${admin.uid}
    claim     admin=${admin.isAdmin}

  Sign in at /staff-login, or use the "Admin dashboard" dev shortcut
  on the entry screen.
`)
