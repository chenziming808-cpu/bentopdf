#!/usr/bin/env bash
# 阿搜PDF工具箱：把原本从 jsDelivr / githack 运行时加载的 WASM、OCR、字体资源
# 下载到本地缓存 .selfhost-cache/wasm/，构建时由 scripts/copy-selfhost-assets.mjs 拷进 dist/wasm/。
# 组件许可证见 NOTICE.md。
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=".selfhost-cache/wasm"
TMP=".selfhost-cache/tmp"
mkdir -p "$OUT" "$TMP"

PYMUPDF_VERSION=$(grep "pymupdf:" src/js/const/cdn-version.ts | grep -o "'[^']*'" | tr -d "'")
GS_VERSION=$(grep "ghostscript:" src/js/const/cdn-version.ts | grep -o "'[^']*'" | tr -d "'")
CPDF_VERSION=$(grep -o "coherentpdf@[0-9.]*" src/js/utils/wasm-provider.ts | head -1 | cut -d@ -f2)
TESS_VERSION=$(node -p "require('./package-lock.json').packages['node_modules/tesseract.js'].version")
TESS_CORE_VERSION=$(node -p "require('./package-lock.json').packages['node_modules/tesseract.js-core'].version")
TESSDATA_VERSION="4.0.0_best_int"
OCR_LANGS="${OCR_LANGS:-eng chi_sim chi_tra}"

pack() { # $1=spec $2=dest-dir $3=subdir-in-package
  local f; f=$(cd "$TMP" && npm pack "$1" --quiet | tail -1)
  rm -rf "$TMP/x" && mkdir -p "$TMP/x" "$2"
  tar xzf "$TMP/$f" -C "$TMP/x"
  cp -r "$TMP/x/package/$3"* "$2/"
}

[ -d "$OUT/pymupdf" ] || pack "@bentopdf/pymupdf-wasm@$PYMUPDF_VERSION" "$OUT/pymupdf" ""
[ -d "$OUT/gs" ]      || pack "@bentopdf/gs-wasm@$GS_VERSION" "$OUT/gs" "assets/"
[ -d "$OUT/cpdf" ]    || pack "coherentpdf@$CPDF_VERSION" "$OUT/cpdf" "dist/"
[ -d "$OUT/ocr/core" ] || pack "tesseract.js-core@$TESS_CORE_VERSION" "$OUT/ocr/core" ""
if [ ! -f "$OUT/ocr/worker.min.js" ]; then
  pack "tesseract.js@$TESS_VERSION" "$TMP/tess" "dist/"
  cp "$TMP/tess/worker.min.js" "$OUT/ocr/worker.min.js"
fi

mkdir -p "$OUT/ocr/lang-data"
for l in $OCR_LANGS; do
  [ -f "$OUT/ocr/lang-data/$l.traineddata.gz" ] || curl -fsSL \
    "https://cdn.jsdelivr.net/npm/@tesseract.js-data/$l/$TESSDATA_VERSION/$l.traineddata.gz" \
    -o "$OUT/ocr/lang-data/$l.traineddata.gz"
done

# OCR / 文本扁平化回退字体（原 rawcdn.githack.com）
mkdir -p "$OUT/ocr/fonts"
grep -o "https://rawcdn.githack.com/[^']*" src/js/config/font-mappings.ts | sort -u | while read -r url; do
  f="$OUT/ocr/fonts/$(basename "$url")"
  [ -f "$f" ] || curl -fsSL "$url" -o "$f"
done

# PDF 编辑器字体包（原 cdn.jsdelivr.net/npm/@embedpdf）
grep -o "'fonts-[a-z]*@[^']*'" src/js/config/editor-fonts.ts | tr -d "'" | while read -r p; do
  f="$OUT/embedpdf/$p"
  mkdir -p "$(dirname "$f")"
  [ -f "$f" ] || curl -fsSL "https://cdn.jsdelivr.net/npm/@embedpdf/$p" -o "$f"
done

rm -rf "$TMP"
du -sh "$OUT"/* "$OUT"
