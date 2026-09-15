#!/usr/bin/env node
/**
 * Seeds the local emulator with everything needed to click around the
 * PLATFORM: an operator account and TWO orgs with distinct branding —
 * so multi-tenancy is visibly exercised in every local session (two brand
 * pages, two published hunts, isolation provable by eye).
 *
 *   npm run seed          (from the repo root)
 *
 * Idempotent — run it after every emulator restart. The Auth, Firestore and
 * Storage emulators start empty and do not persist, so this is the fastest
 * path from a cold start to a working app.
 *
 * It drives the REAL API with a real ID token rather than writing to
 * Firestore directly, so a broken auth gate or a schema change fails the seed
 * instead of silently producing data the app cannot read. Images go straight
 * to the Storage emulator (authenticated, exactly as the admin UI would).
 *
 * Dependency-free on purpose: Node 18+ has fetch, plus the built-in fs/path.
 */
import { readFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const API = process.env.SEED_API_URL ?? 'http://127.0.0.1:6001/demo-app/us-central1/api'
const AUTH = process.env.SEED_AUTH_URL ?? 'http://127.0.0.1:10099'
const STORAGE = process.env.SEED_STORAGE_URL ?? 'http://127.0.0.1:10199'
// Base of the stored download URLs. Defaults to the emulator (works on this
// machine); set to the dev server origin to view images on a phone. See the
// seed-assets README.
const PUBLIC_STORAGE = process.env.SEED_STORAGE_PUBLIC_URL ?? STORAGE
const BUCKET = process.env.SEED_STORAGE_BUCKET ?? 'demo-app.appspot.com'
const API_KEY = 'demo-api-key'

// The two demo orgs. BATS is the fully-dressed club (logo, avatars, target
// photos from seed-assets); HAWKS is deliberately minimal but PUBLISHED, so
// switching between /louisville-bats and /harbor-hawks proves isolation.
const BATS = 'louisville-bats'
const HAWKS = 'harbor-hawks'

const ASSETS = join(dirname(fileURLToPath(import.meta.url)), 'seed-assets')

function die(message, hint) {
  console.error(`\n  x ${message}`)
  if (hint) console.error(`    ${hint}`)
  console.error('')
  process.exit(1)
}

async function call(path, options = {}, allowStatuses = []) {
  let res
  try {
    res = await fetch(`${API}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    })
  } catch {
    die(`Could not reach the functions emulator at ${API}`, 'Start it first:  npm run emulators')
  }
  if (!res.ok && !allowStatuses.includes(res.status)) {
    die(`${options.method ?? 'GET'} ${path} failed: HTTP ${res.status}`, await res.text())
  }
  if (res.status === 204) return null
  return res.json().catch(() => null)
}

// ── Storage assets ────────────────────────────────────────────────────
const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
}

function mimeOf(file) {
  return MIME[extname(file).toLowerCase()] ?? null
}

/** Image files in a seed-assets subfolder, name-sorted, or [] if none/missing. */
async function imagesIn(folder) {
  const dir = join(ASSETS, folder)
  if (!existsSync(dir)) return []
  const names = await readdir(dir)
  return names
    .filter((n) => mimeOf(n))
    .sort()
    .map((name) => ({ name, path: join(dir, name) }))
}

/** "01-buddy-bat.png" → "Buddy Bat". */
function labelize(fileName) {
  const base = fileName.replace(extname(fileName), '').replace(/^[\d]+[-_\s]*/, '')
  const words = base.replace(/[-_]+/g, ' ').trim() || 'Avatar'
  return words.replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 40)
}

/**
 * Uploads one image to the Storage emulator and returns its download URL —
 * or null on any problem, so a bad asset degrades to "no image" rather than
 * failing the whole seed.
 */
async function upload(idToken, file, storagePath) {
  const mime = mimeOf(file.name)
  if (!mime) return null
  let res
  try {
    const bytes = await readFile(file.path)
    if (bytes.length > 5 * 1024 * 1024) {
      console.warn(`   ! ${file.name} is over 5 MB — skipped (storage.rules cap)`)
      return null
    }
    res = await fetch(`${STORAGE}/v0/b/${BUCKET}/o?name=${encodeURIComponent(storagePath)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': mime },
      body: bytes,
    })
  } catch {
    console.warn(`   ! could not reach the Storage emulator at ${STORAGE} — ${file.name} skipped`)
    return null
  }
  if (!res.ok) {
    console.warn(`   ! upload failed for ${file.name}: HTTP ${res.status}`)
    return null
  }
  const meta = await res.json().catch(() => ({}))
  const token = (meta.downloadTokens ?? meta.metadata?.firebaseStorageDownloadTokens ?? '').split(',')[0]
  const url = `${PUBLIC_STORAGE}/v0/b/${BUCKET}/o/${encodeURIComponent(storagePath)}?alt=media`
  return token ? `${url}&token=${token}` : url
}

// ── 1. Operator account ───────────────────────────────────────────────
// Custom claims cannot be set from a client SDK, so the function does it.
// The claim now means PLATFORM OPERATOR — it passes every org gate, which
// is what lets this script drive both orgs with one token.
const admin = await call('/dev/seed-admin', { method: 'POST', body: '{}' })

const signIn = await fetch(
  `${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: admin.email, password: admin.password, returnSecureToken: true }),
  },
).catch(() => die(`Could not reach the Auth emulator at ${AUTH}`, 'Is it running?'))

const { idToken } = await signIn.json()
if (!idToken) die('Signed in but got no ID token.', 'Is the Auth emulator healthy?')

const auth = { Authorization: `Bearer ${idToken}` }

// ── 2. The orgs ───────────────────────────────────────────────────────
// 409 = already exists (a re-run), which is fine — the seed is idempotent.
await call(
  '/orgs',
  { method: 'POST', headers: auth, body: JSON.stringify({ slug: BATS, teamName: 'Louisville Bats' }) },
  [409],
)
await call(
  '/orgs',
  { method: 'POST', headers: auth, body: JSON.stringify({ slug: HAWKS, teamName: 'Harbor Hawks' }) },
  [409],
)

// Both demo orgs exist to show OFF branding, but every tenant is created on
// the free plan (platform-branded), and the branding write is enforced against
// the plan server-side. So put them on a paid plan first — otherwise their
// custom colors/logo would be coerced straight back to the neutral Huntima
// skin. Operator-only endpoint; this script holds the operator token. The
// consumer personas (personal spaces) stay free on purpose, to show the
// unbranded default.
await call(`/t/${BATS}/admin/plan`, { method: 'PUT', headers: auth, body: JSON.stringify({ plan: 'business' }) })
await call(`/t/${HAWKS}/admin/plan`, { method: 'PUT', headers: auth, body: JSON.stringify({ plan: 'business' }) })

// ── 3. Louisville Bats: images + full branding ────────────────────────
console.log('  Uploading images from seed-assets…')

const [logoFiles, avatarFiles, mapFiles] = await Promise.all([
  imagesIn('logo'),
  imagesIn('avatars'),
  imagesIn('venue-map'),
])

const logoUrl = logoFiles.length
  ? await upload(idToken, logoFiles[0], `tenants/${BATS}/assets/seed-${logoFiles[0].name}`)
  : null

// The venue plan missions are pinned onto. Optional like every seed asset:
// with the folder empty the map view simply never appears, which is also the
// state a brand-new org is in.
const venueMapUrl = mapFiles.length
  ? await upload(idToken, mapFiles[0], `tenants/${BATS}/assets/seed-${mapFiles[0].name}`)
  : null

const avatars = []
for (const file of avatarFiles.slice(0, 24)) {
  const url = await upload(idToken, file, `tenants/${BATS}/assets/seed-${file.name}`)
  if (url) {
    avatars.push({
      id: `seed-${file.name.replace(extname(file.name), '')}`.slice(0, 60),
      url,
      label: labelize(file.name),
    })
  }
}

// Louisville Bats — Triple-A affiliate of the Cincinnati Reds. Since their
// 2015/16 rebrand the club uses a red / navy / white scheme.
const tenant = await call(`/t/${BATS}/admin/tenant`, {
  method: 'PUT',
  headers: auth,
  body: JSON.stringify({
    teamName: 'Louisville Bats',
    prizeLocation: 'the Bats Team Store',
    badgeTarget: 8,
    timezone: 'America/New_York',
    brandBase: '#14284b',
    accentBase: '#c8102e',
    fontFamily: 'system',
    logoUrl,
    avatars,
    venueMapUrl,
  }),
})

// ── 4. The Bats' published hunt ───────────────────────────────────────
// Staff-authored copy is literal text, never i18n keys — it is user-generated
// content. Ten ballpark things to photograph around Slugger Field.
const NAVY = '#14284b'
const RED = '#c8102e'
const STEEL = '#2f4a7c'
const SLATE = '#41618f'

// [title, hint, kind, color, level, spot]
//
// `level` groups missions into chapters on the hub; `spot` is where the pin
// sits on the venue map as a fraction of the image (0-1, origin top-left).
// Both are optional in the contract — the Hawks hunt below deliberately sets
// NEITHER, so a dev always has one grouped hunt and one flat one on screen.
const ROOKIE = 'Level 1: Rookie'
const REGULAR = 'Level 2: Regular'
const LEGEND = 'Level 3: Legend'

const MISSIONS = [
  ['The Bat at the Gate', 'Find the statue or big bat by the main entrance and frame it head-on.', 'photo', NAVY, ROOKIE, { x: 0.5, y: 0.88 }],
  ['Big Slugger Energy', "Louisville's giant Slugger bat. Fit the whole thing in frame, knob to tip.", 'photo', RED, ROOKIE, { x: 0.22, y: 0.8 }],
  ['Team Store Haul', 'Snap the entrance sign of the Bats Team Store.', 'photo', STEEL, ROOKIE, { x: 0.76, y: 0.82 }],
  ['Down the Foul Line', 'Stand where you can see a whole foul pole, top to bottom.', 'photo', SLATE, ROOKIE, { x: 0.14, y: 0.45 }],
  ['Brick & History', "Slugger Field's old train-station brick facade. Frame one of the arches.", 'photo', NAVY, REGULAR, { x: 0.86, y: 0.5 }],
  ['Fly the Flags', 'A row of pennants or division banners. Catch them flying.', 'photo', STEEL, REGULAR, { x: 0.5, y: 0.12 }],
  ['Concourse Eats', 'Your ballpark snack, held up in front of the field. Make it look good.', 'photo', RED, REGULAR, { x: 0.3, y: 0.64 }],
  ['Read the Board', 'Zoom in on the scoreboard and frame the current inning.', 'spyglass', SLATE, LEGEND, { x: 0.68, y: 0.2 }],
  ['Meet Buddy Bat', 'The mascot is working the crowd. Catch it in the box.', 'spyglass', RED, LEGEND, null],
  ['Seventh-Inning Stretch', 'During the stretch, capture the crowd up on their feet.', 'spyglass', NAVY, LEGEND, null],
]

const existing = await call(`/t/${BATS}/admin/campaigns`, { headers: auth })
const SEED_NAME = 'Slugger Field Safari'
let hunt = existing.campaigns.find((c) => c.name === SEED_NAME)

if (!hunt) {
  hunt = await call(`/t/${BATS}/admin/campaigns`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ name: SEED_NAME, status: 'draft', badgeTarget: 8 }),
  })
}

// Prize, shown on the redeem screen when a fan wins. Its image (if any)
// reuses the campaign target-photo path, exactly like the admin prize upload.
const prizeFiles = await imagesIn('prize')
const prizeImageUrl = prizeFiles.length
  ? await upload(
      idToken,
      prizeFiles[0],
      `tenants/${BATS}/campaigns/${hunt.id}/targets/seed-prize-${prizeFiles[0].name}`,
    )
  : null

await call(`/t/${BATS}/admin/campaigns/${hunt.id}`, {
  method: 'PATCH',
  headers: auth,
  body: JSON.stringify({
    prize: {
      name: 'Louisville Bats prize pack',
      description: 'A team cap and a voucher for the Bats Team Store. Collect at the counter.',
      imageUrl: prizeImageUrl,
      winnerLimit: 50,
    },
  }),
})

// Target photos map to missions in file-name order; missing ones stay null.
console.log('  Uploading mission target photos…')
const targetFiles = await imagesIn('targets')
const targetUrls = []
for (let i = 0; i < MISSIONS.length; i++) {
  const file = targetFiles[i]
  targetUrls.push(
    file
      ? await upload(idToken, file, `tenants/${BATS}/campaigns/${hunt.id}/targets/seed-${file.name}`)
      : null,
  )
}

await call(`/t/${BATS}/admin/campaigns/${hunt.id}/missions`, {
  method: 'PUT',
  headers: auth,
  body: JSON.stringify({
    missions: MISSIONS.map(([title, hint, kind, color, level, spot], order) => ({
      id: `seed-${order + 1}`,
      kind,
      title: { text: title },
      hint: { text: hint },
      color,
      targetImageUrl: targetUrls[order],
      order,
      group: { text: level },
      // Two missions are deliberately left unpinned, so the map view's
      // "N more not on the map" line is exercised too.
      spot,
    })),
  }),
})

// Publishing is exclusive PER ORG server-side: making one hunt live demotes
// the rest of that org's hunts only. Only publish the demo hunt when nothing
// else in this org already is — re-running the seed must not yank the live
// slot from a custom hunt you are mid-way through testing.
const otherLive = existing.campaigns.find((c) => c.status === 'published' && c.id !== hunt.id)
const published = !otherLive
if (published) {
  await call(`/t/${BATS}/admin/campaigns/${hunt.id}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({ status: 'published' }),
  })
}

// ── 5. Harbor Hawks: a second, visibly different org ──────────────────
// Minimal on purpose: no images, different palette, a small published hunt.
// Its whole job is to make cross-org isolation obvious in local dev.
await call(`/t/${HAWKS}/admin/tenant`, {
  method: 'PUT',
  headers: auth,
  body: JSON.stringify({
    teamName: 'Harbor Hawks',
    prizeLocation: 'the Hawks Nest kiosk',
    badgeTarget: 3,
    timezone: 'America/Los_Angeles',
    brandBase: '#0e5a4a',
    accentBase: '#e8792b',
    fontFamily: 'system',
    logoUrl: null,
    avatars: [],
  }),
})

const HAWKS_HUNT = 'Harborfront Hunt'
const hawksExisting = await call(`/t/${HAWKS}/admin/campaigns`, { headers: auth })
let hawksHunt = hawksExisting.campaigns.find((c) => c.name === HAWKS_HUNT)
if (!hawksHunt) {
  hawksHunt = await call(`/t/${HAWKS}/admin/campaigns`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ name: HAWKS_HUNT, status: 'draft', badgeTarget: 3 }),
  })
}

// Deliberately NO levels and NO map pins: this is the flat, unmapped hunt a
// brand-new org authors, and the fan hub has to look right for it too.
const HAWKS_MISSIONS = [
  ['The Mascot Perch', 'Find Harley Hawk and get them in frame.', 'photo', '#0e5a4a'],
  ['Harbor View', 'Frame the water from the concourse rail.', 'photo', '#e8792b'],
  ['Nest Noise', 'Catch the crowd mid-cheer from your seat.', 'spyglass', '#12735e'],
]

await call(`/t/${HAWKS}/admin/campaigns/${hawksHunt.id}/missions`, {
  method: 'PUT',
  headers: auth,
  body: JSON.stringify({
    missions: HAWKS_MISSIONS.map(([title, hint, kind, color], order) => ({
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

const hawksLive = hawksExisting.campaigns.find(
  (c) => c.status === 'published' && c.id !== hawksHunt.id,
)
if (!hawksLive) {
  await call(`/t/${HAWKS}/admin/campaigns/${hawksHunt.id}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({ status: 'published' }),
  })
}

// ── Done ──────────────────────────────────────────────────────────────
const targetCount = targetUrls.filter(Boolean).length
console.log(`
  Seeded.

    operator  ${admin.email} / ${admin.password}
    org       /${BATS}  — ${tenant.teamName} (logo: ${logoUrl ? 'yes' : 'none'}, avatars: ${avatars.length})
              hunt "${SEED_NAME}" (${published ? 'published' : 'left as draft — another hunt is already live'}, ${MISSIONS.length} missions, ${targetCount} target photos)
    org       /${HAWKS}  — Harbor Hawks
              hunt "${HAWKS_HUNT}" (published, ${HAWKS_MISSIONS.length} missions)

  Open /${BATS} and tap "Continue as guest" — then open /${HAWKS} and watch
  the brand and hunt change. Organizer sign-in lives at /staff-login.
`)
