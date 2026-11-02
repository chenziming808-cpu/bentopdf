// 阿搜: add the ICP filing number (工信部备案号) to every page footer in dist/.
// Runs after the other HTML post-processing and before compression.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '../dist');
const ICP = (process.env.ICP_BEIAN || '京ICP备2026038639号-1').trim();
const MARK = 'data-asou-icp';
// Embedded PDF viewers (iframes) are not site pages.
const SKIP = /(^|\/)(pdfjs-viewer|pdfjs-annotation-viewer)\//;

const link = `<a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener" class="hover:text-gray-300">${ICP}</a>`;
const inFooter = `<div class="container mx-auto px-4 mt-6 text-center text-gray-500 text-xs" ${MARK}>${link}</div>`;
// Full-height app pages (multi-tool, workflow) have no footer: a thin row.
const bareRow = `<div class="flex-shrink-0 py-1 text-center text-gray-500 text-xs" ${MARK}>${link}</div>`;

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : e.name.endsWith('.html') ? [p] : [];
  });

let footer = 0;
let bare = 0;
for (const file of walk(DIST)) {
  const rel = path.relative(DIST, file);
  if (SKIP.test(rel)) continue;
  let html = fs.readFileSync(file, 'utf8');
  if (html.includes(MARK)) continue;
  const i = html.lastIndexOf('</footer>');
  if (i !== -1) {
    html = `${html.slice(0, i)}  ${inFooter}\n    ${html.slice(i)}`;
    footer++;
  } else {
    const j = html.lastIndexOf('</body>');
    if (j === -1) continue;
    html = `${html.slice(0, j)}  ${bareRow}\n  ${html.slice(j)}`;
    bare++;
  }
  fs.writeFileSync(file, html);
}
console.log(`[asou-icp] ${ICP}: ${footer} footers, ${bare} footerless pages`);
