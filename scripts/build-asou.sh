#!/usr/bin/env bash
# Build 阿搜PDF工具箱 (modified BentoPDF) into dist/.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source ./asou.env; set +a
[ -d .selfhost-cache/wasm ] || bash scripts/fetch-selfhost-assets.sh
node scripts/generate-static-tool-links.mjs
npx tsc
npx vite build
node scripts/enhance-seo-pages.mjs
NODE_OPTIONS='--max-old-space-size=3072' node scripts/generate-i18n-pages.mjs
node scripts/copy-selfhost-assets.mjs
node scripts/rebrand-dist.mjs
node scripts/generate-sitemap.mjs
node scripts/generate-security-headers.mjs
node scripts/apply-indexing-policy.mjs
node scripts/compress-static-assets.mjs
node scripts/seo-audit.mjs || echo "[asou] seo-audit reported issues (non-fatal)"
