#!/bin/bash
# Builds  assistant3d.js  (the 3D character of X Assistant) from  scripts/assistant3d.src.js  +  three.js.
# Needs Node and network access to the npm registry. Nothing is installed into the repository: the work happens in a temp folder.
# Usage:  bash scripts/build_assistant3d.sh
set -e
HERE="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
cd "$TMP"
npm init -y >/dev/null
npm i three@0.187.0 esbuild@0.28.2 --no-audit --no-fund >/dev/null
cp "$HERE/scripts/assistant3d.src.js" ./src.js
npx esbuild src.js --bundle --minify --format=iife --global-name=XAS3D --target=es2019 --legal-comments=inline --outfile="$HERE/assistant3d.js"
echo "built $HERE/assistant3d.js ($(wc -c < "$HERE/assistant3d.js") bytes)"
rm -rf "$TMP"
