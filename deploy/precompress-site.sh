#!/usr/bin/env bash
# Precompress the static site for nginx gzip_static.
# (.br output is opt-in via EXTS="br gz": the distro nginx 1.24 rpm on the
# server segfaults with a self-built ngx_brotli static module, so it is not
# loaded and .br files would not be served.)
# Run on the server after every deploy (idempotent, mtime-aware):
#   bash precompress-site.sh /var/www/pdf.metext.xyz
# - repacks Pyodide wheels as ZIP_STORED (see repack-wheels.py)
# - writes <file>.br (brotli -q 11 --lgwin 24) and <file>.gz (gzip -9) next to
#   each compressible file when missing or older than the file, and keeps a copy
#   only if it saves >= 5%. Stale copies of deleted/changed files are refreshed.
set -euo pipefail
ROOT="${1:-/var/www/pdf.metext.xyz}"
HERE="$(cd "$(dirname "$0")" && pwd)"
JOBS="${JOBS:-2}"
export EXTS="${EXTS:-gz}"
cd "$ROOT"
nice -n 19 python3 "$HERE/repack-wheels.py" wasm

compress_one() {
  f="$1"
  size=$(stat -c %s "$f")
  for ext in $EXTS; do
    out="$f.$ext"
    if [ -e "$out" ] && [ ! "$f" -nt "$out" ]; then continue; fi
    tmp="$out.tmp$$"
    if [ "$ext" = br ]; then brotli -q 11 --lgwin=24 -c "$f" > "$tmp"; else gzip -9 -n -c "$f" > "$tmp"; fi
    if [ $(( $(stat -c %s "$tmp") * 100 )) -lt $(( size * 95 )) ]; then
      chmod 644 "$tmp"; mv -f "$tmp" "$out"
    else
      rm -f "$tmp" "$out"
    fi
  done
}
export -f compress_one

find . -type f -size +1k -regextype posix-extended \
  -regex '.*\.(html|js|mjs|css|json|svg|xml|txt|webmanifest|wasm|whl|zip|otf|ttf|data|bcmap|ftl|pfb|icc|map)$' \
  -print0 | nice -n 19 xargs -0 -r -n 1 -P "$JOBS" bash -c 'compress_one "$0"'

# Drop orphaned .br copies whose source file is gone. (.gz is left alone: some
# originals are shipped gzipped, e.g. libreoffice-wasm/soffice.wasm.gz.)
find . -type f -name '*.br' -print0 |
  while IFS= read -r -d '' c; do [ -e "${c%.*}" ] || rm -f "$c"; done
echo "precompress-site: done ($(find . -name '*.br' | wc -l) .br, $(find . -name '*.gz' | wc -l) .gz)"
