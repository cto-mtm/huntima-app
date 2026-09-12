#!/usr/bin/env node
/**
 * Grant (or revoke) the `admin` custom claim on a real user.
 *
 * This is the production counterpart to the emulator-only `/dev/seed-admin`
 * route: there is deliberately NO in-app way to mint an admin, so the first
 * staff account is promoted here, once, by an operator with project access.
 *
 *   node firebase/functions/scripts/grant-admin.mjs someone@club.com
 *   node firebase/functions/scripts/grant-admin.mjs someone@club.com --revoke
 *
 * or, from the repo root:
 *   npm run grant-admin -w firebase/functions -- someone@club.com
 *
 * Auth uses Application Default Credentials — set one of these up first:
 *   gcloud auth application-default login
 *   (or) export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 *
 * The person must have signed in at least once (Google or email/password) so
 * their account exists in Firebase Auth before you can promote it. After the
 * claim changes they must sign out and back in for it to take effect — the
 * app reads `admin` from the ID token, which only refreshes on a new session.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { applicationDefault, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

const [email, flag] = process.argv.slice(2)
const revoke = flag === '--revoke'

function die(message, hint) {
  console.error(`\n  x ${message}`)
  if (hint) console.error(`    ${hint}`)
  console.error('')
  process.exit(1)
}

if (!email || email.startsWith('--')) {
  die('Usage: grant-admin.mjs <email> [--revoke]')
}

/** Project id from .firebaserc (the single source of truth), env can override. */
function resolveProjectId() {
  if (process.env.GOOGLE_CLOUD_PROJECT) return process.env.GOOGLE_CLOUD_PROJECT
  try {
    const here = dirname(fileURLToPath(import.meta.url))
    const rc = JSON.parse(readFileSync(join(here, '../../../.firebaserc'), 'utf8'))
    return rc.projects?.default
  } catch {
    return undefined
  }
}

const projectId = resolveProjectId()
if (!projectId || projectId.includes('REPLACE_ME')) {
  die(
    'No real project id found.',
    'Set it in .firebaserc, or pass GOOGLE_CLOUD_PROJECT=your-project-id.',
  )
}

initializeApp({ credential: applicationDefault(), projectId })
const auth = getAuth()

// The credential is loaded lazily, so a bad/absent ADC surfaces HERE, on the
// first real call — not at initializeApp. Tell those two failures apart so a
// credentials problem doesn't read as "no such user".
let user
try {
  user = await auth.getUserByEmail(email)
} catch (err) {
  if (err?.code === 'auth/user-not-found') {
    die(
      `No user with email ${email} in project ${projectId}.`,
      'They must sign in to the app once (Google or email/password) before you can promote them.',
    )
  }
  die(
    `Could not reach Firebase Auth for project ${projectId}: ${err?.code ?? err}`,
    'Check credentials (`gcloud auth application-default login` or GOOGLE_APPLICATION_CREDENTIALS) and the project id.',
  )
}

// Merge, don't clobber: preserve any other claims the account may carry.
const claims = { ...(user.customClaims ?? {}), admin: !revoke }
await auth.setCustomUserClaims(user.uid, claims)

console.log(`\n  ${revoke ? 'Revoked' : 'Granted'} admin for ${email}  (uid ${user.uid}, project ${projectId})`)
console.log('  They must sign out and back in for the change to take effect.\n')
process.exit(0)
