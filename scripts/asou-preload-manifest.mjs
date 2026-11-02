// 阿搜: write dist/wasm/asou-preload.json — the heavy runtime files each hot
// tool page warms in the background (see src/js/utils/asou-tool-preload.ts).
// Sizes are the decoded (on-disk) byte sizes, used only for the progress bar.
import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve(process.argv[2] || 'dist');
const isPlain = (f) => !/\.(gz|br)$/.test(f);
const entry = (rel) => {
  const abs = path.join(dist, rel);
  if (!fs.existsSync(abs)) throw new Error(`[asou-preload] missing ${rel}`);
  return {
    url: '/' + rel.split(path.sep).join('/'),
    size: fs.statSync(abs).size,
  };
};
const list = (dir, re) =>
  fs
    .readdirSync(path.join(dist, dir))
    .filter((f) => isPlain(f) && re.test(f))
    .sort()
    .map((f) => entry(path.join(dir, f)));
const one = (dir, re) => {
  const found = list(dir, re);
  if (found.length !== 1)
    throw new Error(
      `[asou-preload] expected 1 match for ${re} in ${dir}, got ${found.length}`
    );
  return found;
};

// Pyodide runtime first (small, needed to start), then wheels largest-last.
const pyFirst = [
  'pyodide.js',
  'pyodide.asm.js',
  'pyodide-lock.json',
  'pyodide.asm.wasm',
  'python_stdlib.zip',
];
const pyAssets = 'wasm/pymupdf/assets';
const wheels = list(pyAssets, /\.whl$/).sort((a, b) => a.size - b.size);

const groups = {
  pdfjs: one('assets', /^pdf\.worker-.*\.js$/),
  pymupdf: [
    entry('wasm/pymupdf/dist/index.js'),
    ...pyFirst.map((f) => entry(path.join(pyAssets, f))),
    ...wheels,
  ],
  'hyper-compress': [
    ...one('assets', /^hyper-compress\.worker-.*\.js$/),
    ...one('assets', /^hyper-compress-.*\.wasm$/),
  ],
  cpdf: [entry('wasm/cpdf/coherentpdf.browser.min.js')],
  qpdf: [entry('qpdf.wasm')],
  'ocr-worker': [entry('wasm/ocr/worker.min.js')],
  'ocr-core': list('wasm/ocr/core', /^tesseract-core.*-?lstm\.wasm\.js$/),
  'ocr-chi_sim': [entry('wasm/ocr/lang-data/chi_sim.traineddata.gz')],
  'ocr-font-sc': [entry('wasm/ocr/fonts/NotoSansCJKsc-Regular.otf')],
};

const out = path.join(dist, 'wasm', 'asou-preload.json');
fs.writeFileSync(out, JSON.stringify({ version: 1, groups }));
const mb = (g) =>
  (groups[g].reduce((s, f) => s + f.size, 0) / 1048576).toFixed(1);
console.log(
  '[asou-preload] wrote',
  out,
  Object.keys(groups)
    .map((g) => `${g}=${groups[g].length}f/${mb(g)}MB`)
    .join(' ')
);
