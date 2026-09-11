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

# ── 1. Build the SPA ──────────────────────────────────────────────────
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

echo "==> Done."
