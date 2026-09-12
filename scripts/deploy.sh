#!/usr/bin/env bash
#
# The one true deploy path.
#
#   ./scripts/deploy.sh
#
# Builds the SPA, stages it where Firebase Hosting expects it, and deploys
# both Hosting and Functions to the project in .firebaserc.
#
# Prerequisites:
#   - npm i -g firebase-tools && firebase login
#   - .firebaserc points at a real project id
#   - app/.env sets VITE_API_URL to the deployed function URL
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# ── Guard: refuse to deploy against the scaffold placeholder ──────────
if grep -q "REPLACE_ME" .firebaserc; then
  echo "ERROR: .firebaserc still contains REPLACE_ME." >&2
  echo "       Set your real Firebase project id before deploying:" >&2
  echo '       { "projects": { "default": "your-project-id" } }' >&2
  exit 1
fi

# ── Guard: a prod build with the emulator URL baked in is a silent bug ─
if [ -f app/.env ] && grep -qE 'VITE_API_URL=.*(127\.0\.0\.1|localhost)' app/.env; then
  echo "ERROR: app/.env points VITE_API_URL at the local emulator." >&2
  echo "       Vite inlines this at build time, so the deployed app would" >&2
  echo "       call your laptop. Set the production function URL first." >&2
  exit 1
fi

# ── 1. Build everything, in dependency order ──────────────────────────
# shared FIRST: both the app and the functions compile against shared/dist,
# so a stale build here silently ships an old contract to one side or both.
echo "==> Building shared/"
npm run build:shared

# The functions bundle inlines shared, so it must be rebuilt after it.
# firebase.json also declares a predeploy hook that does this, for anyone
# running a bare `firebase deploy` — belt and braces, because shipping a
# stale lib/ is invisible until something breaks in production.
echo "==> Building firebase/functions/"
npm run build -w firebase/functions

echo "==> Building app/"
cd app
npm run build
cd "$REPO_ROOT"

# ── 2. Stage dist/ where firebase.json's `hosting.public` points ───────
echo "==> Staging app/dist -> firebase/app"
rm -rf firebase/app
cp -r app/dist firebase/app

# ── 3. Deploy Hosting + Functions ─────────────────────────────────────
echo "==> Deploying"
cd firebase
firebase deploy

cd "$REPO_ROOT"
echo "==> Done."
echo ""
echo "Post-deploy checklist:"
echo "  - GEMINI_API_KEY set as a secret?   firebase functions:secrets:set GEMINI_API_KEY"
echo "  - First admin promoted?             npm run grant-admin -- someone@your-club.com"
echo "    (they must sign in once first, then sign out/in after being granted)"
