#!/usr/bin/env bash
# Download the source catalogues into ./vendor (git-ignored). Every source is pinned, so builds are reproducible.
# Usage: tools/fetch_data.sh
set -euo pipefail
cd "$(dirname "$0")/.."

D3C_VERSION=0.7.35                                          # d3-celestial (BSD-3-Clause)
ASTRO_VERSION=2.1.19                                        # astronomy-engine (MIT) — only used by the offline smoke test
HYG_COMMIT=c7f7f883fe678cc7680169a50ccd7dcc49b060ce         # astronexus/HYG-Database (CC BY-SA 4.0)
STELLARIUM_COMMIT=898c3600d8f3befb986323639c0f3def2cf35158  # Stellarium/stellarium (illustrations: Free Art License 1.3)

CURL=(curl -fsSL --retry 6 --retry-delay 3 --retry-all-errors)

rm -rf vendor && mkdir -p vendor/art && cd vendor

echo "→ d3-celestial ${D3C_VERSION}"
npm pack --silent "d3-celestial@${D3C_VERSION}" >/dev/null
mkdir -p d3c && tar xzf "d3-celestial-${D3C_VERSION}.tgz" -C d3c && rm "d3-celestial-${D3C_VERSION}.tgz"

echo "→ astronomy-engine ${ASTRO_VERSION}"
npm pack --silent "astronomy-engine@${ASTRO_VERSION}" >/dev/null
tar xzf "astronomy-engine-${ASTRO_VERSION}.tgz" package/astronomy.browser.min.js
mv package/astronomy.browser.min.js . && rm -rf package "astronomy-engine-${ASTRO_VERSION}.tgz"

echo "→ HYG 3.8 @ ${HYG_COMMIT:0:7}"
"${CURL[@]}" -o hyg.csv.gz "https://raw.githubusercontent.com/astronexus/HYG-Database/${HYG_COMMIT}/hyg/v3/hyg_v38.csv.gz"

echo "→ Stellarium modern sky culture @ ${STELLARIUM_COMMIT:0:7}"
BASE="https://raw.githubusercontent.com/Stellarium/stellarium/${STELLARIUM_COMMIT}/skycultures/modern"
"${CURL[@]}" -o modern.json "$BASE/index.json"
python3 -c "import json;[print(c['image']['file']) for c in json.load(open('modern.json'))['constellations'] if 'image' in c]" |
  sort -u | while read -r f; do "${CURL[@]}" -o "art/$(basename "$f")" "$BASE/$f"; sleep 0.2; done

echo "✓ vendor/ ready ($(ls art | wc -l | tr -d ' ') illustrations)"
