#!/usr/bin/env bash
# Builds store-ready packages:
#   dist/texport-markers-firefox-<ver>.zip  -> addons.mozilla.org
#   dist/texport-markers-chrome-<ver>.zip   -> Chrome Web Store (also Edge, Brave, Opera)
set -euo pipefail
cd "$(dirname "$0")"
VER=$(python3 -c "import json;print(json.load(open('manifest.base.json'))['version'])")
rm -rf dist && mkdir -p dist/firefox dist/chrome
for t in firefox chrome; do
  cp -r src/. "dist/$t/"
  rm -f "dist/$t/icons/icon.svg"
done
python3 - <<'PY'
import json
m = json.load(open("manifest.base.json"))
ff = dict(m)
ff["background"] = {"scripts": ["background.js"]}
ff["browser_specific_settings"] = {
    # 140 / 142 are the first versions that understand data_collection_permissions
    "gecko": {
        "id": "texport-markers@americanmilestone",
        "strict_min_version": "140.0",
        "data_collection_permissions": {"required": ["none"]}},
    "gecko_android": {"strict_min_version": "142.0"}}
json.dump(ff, open("dist/firefox/manifest.json", "w"), indent=2)
ch = dict(m)
ch["background"] = {"service_worker": "background.js"}
ch["minimum_chrome_version"] = "110"
json.dump(ch, open("dist/chrome/manifest.json", "w"), indent=2)
PY
(cd dist/firefox && zip -qr -X "../texport-markers-firefox-$VER.zip" .)
(cd dist/chrome && zip -qr -X "../texport-markers-chrome-$VER.zip" .)
ls -1 dist/*.zip
