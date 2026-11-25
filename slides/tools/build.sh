#!/usr/bin/env bash
# 用法：slides/tools/build.sh v1|v2
# 流程：source/<v>/slides/*.html → (render.js) pages/*.html + png/ + notes.json
#       → (extract.js) shapes.json → (build.py) 可編輯 PPTX → (soffice) PDF
#       → (gen_readme.py) slides/<v>/png/NN-<id>.png 與逐頁講稿 README.md
set -euo pipefail
V=${1:?用法: build.sh v1|v2}
HERE=$(cd "$(dirname "$0")" && pwd)
cd "$HERE"
[ -d node_modules/@fontsource/noto-sans-tc ] || npm install --silent
case "$V" in
  v1) FN="2026-11-02_AIDC飛輪儲能_控制邏輯與導入效益_簡報_v1.pptx" ;;
  v2) FN="2026-11-02_AIDC電流漣波與ramp-LVRT_飛輪主動電流補償_簡報_v2.pptx" ;;
  *) echo "unknown deck $V"; exit 1 ;;
esac
rm -rf pages png; mkdir -p pages png
DECK="../source/$V" node render.js
node extract.js
FN="$FN" python3 build.py
OUT="../$V"
mv -f "$FN" "$OUT/$FN"
(cd "$OUT" && soffice --headless --convert-to pdf "$FN" >/dev/null 2>&1 || echo "WARN: soffice 不可用，未產生 PDF")
python3 gen_readme.py "$V"
echo "OK: $OUT/$FN（含 PDF、png/、README.md）"
