#!/usr/bin/env bash
# Publiserer nettversjonen til GitHub Pages (gren gh-pages, mappen app/): https://sandvold.github.io/Skiglede/app/
# Roten (index.html) er mellomsiden for innlogging i appen og røres ikke. Kjør fra repoet: bash scripts/deploy_pages.sh
set -euo pipefail
cd "$(dirname "$0")/.."
REMOTE="$(git remote get-url origin)"
EXPO_BASE_URL=/Skiglede/app npx expo export -p web
TMP="$(mktemp -d)"
git clone --quiet --branch gh-pages --single-branch "$REMOTE" "$TMP"
rm -rf "$TMP/app"
mkdir "$TMP/app"
cp -r dist/. "$TMP/app/"
touch "$TMP/.nojekyll"
cd "$TMP"
git add -A
if git diff --cached --quiet; then echo "Ingen endringer"; exit 0; fi
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -q -m "Nettversjon $(date -u +%Y-%m-%dT%H:%MZ)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013UuhDmuwqgBp5vasHvK5BG"
git push -q origin gh-pages
echo "Publisert: https://sandvold.github.io/Skiglede/app/"
