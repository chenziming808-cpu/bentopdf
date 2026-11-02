#!/usr/bin/env node
// Post-build rebrand for 阿搜PDF工具箱 (a modified BentoPDF, AGPL-3.0).
// Replaces the upstream brand in generated pages while keeping the
// attribution / copyright / source references to BentoPDF intact.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const SITE = (process.env.SITE_URL || 'https://pdf.metext.xyz').replace(
  /\/$/,
  ''
);
const HOST = new URL(SITE).host;
const NAME_ZH = '阿搜PDF工具箱';
const NAME_EN = 'Asou PDF Toolbox';
const UPSTREAM_HYPER = 'https://github.com/alam00000/bentopdf-hyper-compress';
const EXT = /\.(html|xml|txt|webmanifest)$/;
const SKIP_DIRS = new Set([
  'wasm',
  'assets',
  'locales',
  'pdfjs-viewer',
  'libreoffice-wasm',
]);

// Attribution contexts that must keep the upstream name.
const PROTECT = [
  /(github\.com\/alam00000\/bentopdf[^"]*"[^>]*>)BentoPDF(?=<\/a>)/g,
  /modified version of (?:the open-source project )?BentoPDF/g,
  /Modified from BentoPDF/g,
  /BentoPDF ?[（(]AGPL/g,
  /基于 ?BentoPDF/g,
  /开源项目 ?BentoPDF/g,
  /BentoPDF 版权/g,
  /BentoPDF's own engine/g,
  /BentoPDF ?自己的引擎/g,
  /ComicInfo[^<]{0,40}BentoPDF/g,
];
const CJK = '\\u3000-\\u303f\\u4e00-\\u9fff\\uff00-\\uffef';

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (dir === dist && SKIP_DIRS.has(name)) continue;
      walk(p, out);
    } else if (EXT.test(name)) out.push(p);
  }
  return out;
}

function rebrand(text, isZh) {
  const name = isZh ? NAME_ZH : NAME_EN;
  const saved = [];
  const hold = (m) => `\u0000${saved.push(m) - 1}\u0000`;
  for (const re of PROTECT) text = text.replace(re, hold);

  text = text
    // social handles / upstream promo meta
    .replace(
      /\s*<meta name="twitter:(?:site|creator)" content="@BentoPDF"\s*\/?>/g,
      ''
    )
    // removed product pages
    .replace(
      /href="\/(?:[a-z]{2}(?:-TW)?\/)?hyper-compress"/g,
      `href="${UPSTREAM_HYPER}" target="_blank" rel="noopener"`
    )
    .replace(/href="\/(?:[a-z]{2}(?:-TW)?\/)?kura"/g, 'href="/"')
    // upstream site URLs -> our site
    .replace(/https?:\/\/(?:www\.)?bentopdf\.com/g, SITE)
    .replace(/contact@bentopdf\.com/g, '小红书：阿搜先生')
    .replace(/(?<![\w./@-])(?:www\.)?bentopdf\.com/g, HOST)
    .replace(/BentoPDF\.com/g, HOST)
    .replace(/Bento PDF/g, name)
    .replace(/BentoPDF/g, name);

  if (isZh) {
    text = text
      .replace(new RegExp(`(?<=[${CJK}]) ${NAME_ZH}`, 'g'), NAME_ZH)
      .replace(new RegExp(`${NAME_ZH} (?=[${CJK}])`, 'g'), NAME_ZH)
      .replace(/在 ?pdf\.metext\.xyz ?上已包含/g, '本站已内置')
      .replace(/即使在 ?pdf\.metext\.xyz ?正式网站上也是如此/g, '本站也是如此');
  }
  return text.replace(/\u0000(\d+)\u0000/g, (_, i) => saved[Number(i)]);
}

let changed = 0;
for (const file of walk(dist)) {
  const rel = relative(dist, file);
  const top = rel.split(sep)[0];
  const isZh = top === 'zh' || top === 'zh-TW';
  const src = readFileSync(file, 'utf8');
  const out = rebrand(src, isZh);
  if (out !== src) {
    writeFileSync(file, out);
    changed++;
  }
}
console.log(`[rebrand] updated ${changed} files`);
