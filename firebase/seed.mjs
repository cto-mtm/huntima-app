#!/usr/bin/env node
/**
 * Seeds the local emulator with everything needed to click around:
 * a staff account, club branding, and a published hunt — now with real images
 * pulled from ./seed-assets (see that folder's README).
 *
 *   npm run seed          (from the repo root)
 *
 * Idempotent — run it after every emulator restart. The Auth, Firestore and
 * Storage emulators start empty and do not persist, so this is the fastest path
 * from a cold start to a working app.
 *
 * It drives the REAL admin API with a real ID token rather than writing to
 * Firestore directly, so a broken auth gate or a schema change fails the seed
 * instead of silently producing data the app cannot read. Images go straight to
 * the Storage emulator (staff-authenticated, exactly as the admin UI would).
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

const ASSETS = join(dirname(fileURLToPath(import.meta.url)), 'seed-assets')

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
    die(`Could not reach the functions emulator at ${API}`, 'Start it first:  npm run emulators')
  }
  if (!res.ok) die(`${options.method ?? 'GET'} ${path} failed: HTTP ${res.status}`, await res.text())
  return res.status === 204 ? null : res.json()
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
 * Uploads one image to the Storage emulator as staff and returns its download
 * URL — or null on any problem, so a bad asset degrades to "no image" rather
 * than failing the whole seed. Read is public (storage.rules), so the URL works
 * with just `alt=media`; the token is included when the emulator returns one.
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

// ── 1. Staff account ──────────────────────────────────────────────────
// Custom claims cannot be set from a client SDK, so the function does it.
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

// ── 2. Images from ./seed-assets ──────────────────────────────────────
console.log('  Uploading images from seed-assets…')

const [logoFiles, avatarFiles] = await Promise.all([imagesIn('logo'), imagesIn('avatars')])

const logoUrl = logoFiles.length
  ? await upload(idToken, logoFiles[0], `tenants/default/assets/seed-${logoFiles[0].name}`)
  : null

const avatars = []
for (const file of avatarFiles.slice(0, 24)) {
  const url = await upload(idToken, file, `tenants/default/assets/seed-${file.name}`)
  if (url) {
    avatars.push({
      id: `seed-${file.name.replace(extname(file.name), '')}`.slice(0, 60),
      url,
      label: labelize(file.name),
    })
  }
}

// ── 3. Club branding ──────────────────────────────────────────────────
// Louisville Bats — Triple-A affiliate of the Cincinnati Reds, playing at
// Louisville Slugger Field. Since their 2015/16 rebrand the club uses a
// red / navy / white scheme: brandBase is the navy, accentBase the red.
const tenant = await call('/admin/tenant', {
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
  }),
})

// ── 4. A published hunt ───────────────────────────────────────────────
// Staff-authored copy is literal text, never i18n keys — it is user-generated
// content. Ten ballpark things to photograph around Slugger Field. Colors stay
// on the Bats navy/red palette so the fallback tiles look on-brand when a
// target photo has not been dropped in seed-assets yet.
const NAVY = '#14284b'
const RED = '#c8102e'
const STEEL = '#2f4a7c'
const SLATE = '#41618f'

const MISSIONS = [
  ['The Bat at the Gate', 'Find the statue or big bat by the main entrance and frame it head-on.', 'photo', NAVY],
  ['Big Slugger Energy', "Louisville's giant Slugger bat. Fit the whole thing in frame, knob to tip.", 'photo', RED],
  ['Team Store Haul', 'Snap the entrance sign of the Bats Team Store.', 'photo', STEEL],
  ['Down the Foul Line', 'Stand where you can see a whole foul pole, top to bottom.', 'photo', SLATE],
  ['Brick & History', "Slugger Field's old train-station brick facade. Frame one of the arches.", 'photo', NAVY],
  ['Fly the Flags', 'A row of pennants or division banners. Catch them flying.', 'photo', STEEL],
  ['Concourse Eats', 'Your ballpark snack, held up in front of the field. Make it look good.', 'photo', RED],
  ['Read the Board', 'Zoom in on the scoreboard and frame the current inning.', 'spyglass', SLATE],
  ['Meet Buddy Bat', 'The mascot is working the crowd. Catch it in the box.', 'spyglass', RED],
  ['Seventh-Inning Stretch', 'During the stretch, capture the crowd up on their feet.', 'spyglass', NAVY],
]

const existing = await call('/admin/campaigns', { headers: auth })
const SEED_NAME = 'Slugger Field Safari'
let hunt = existing.campaigns.find((c) => c.name === SEED_NAME)

if (!hunt) {
  hunt = await call('/admin/campaigns', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ name: SEED_NAME, status: 'draft', badgeTarget: 8 }),
  })
}

// Prize, shown on the redeem screen when a fan wins. Its image (if any) reuses
// the campaign target-photo path, exactly like the admin prize upload.
const prizeFiles = await imagesIn('prize')
const prizeImageUrl = prizeFiles.length
  ? await upload(idToken, prizeFiles[0], `campaigns/${hunt.id}/targets/seed-prize-${prizeFiles[0].name}`)
  : null

await call(`/admin/campaigns/${hunt.id}`, {
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
  targetUrls.push(file ? await upload(idToken, file, `campaigns/${hunt.id}/targets/seed-${file.name}`) : null)
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
      targetImageUrl: targetUrls[order],
      order,
    })),
  }),
})

// Publishing is exclusive server-side: making one hunt live demotes the rest.
// So only publish the demo hunt when nothing else already is — otherwise
// re-running the seed (e.g. to reset the staff account) would yank the live
// slot away from a custom hunt you are in the middle of testing.
const otherLive = existing.campaigns.find((c) => c.status === 'published' && c.id !== hunt.id)
const published = !otherLive
if (published) {
  await call(`/admin/campaigns/${hunt.id}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({ status: 'published' }),
  })
}

// ── Done ──────────────────────────────────────────────────────────────
const targetCount = targetUrls.filter(Boolean).length
console.log(`
  Seeded.

    staff     ${admin.email} / ${admin.password}
    club      ${tenant.teamName}  (logo: ${logoUrl ? 'yes' : 'none'}, avatars: ${avatars.length})
    hunt      ${SEED_NAME} (${published ? 'published' : 'left as draft — another hunt is already live'}, ${MISSIONS.length} missions, ${targetCount} target photos)

  Drop images in firebase/seed-assets/{logo,avatars,targets} and re-run to enrich this.
  Open the app and tap "Continue as guest", or sign in at /staff-login.
`)
