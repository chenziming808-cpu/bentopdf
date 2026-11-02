#!/usr/bin/env node
// 阿搜PDF工具箱: Chinese-first SEO post-processing (Baidu friendly).
//
// Runs after generate-i18n-pages / rebrand / apply-indexing-policy and
// rewrites dist/ so that:
//   *  /<page>          -> Chinese (primary, canonical), built from /zh/<page>
//   *  /en/<page>       -> English (the original un-prefixed upstream page)
//   *  /zh/<page>       -> kept for old links, canonical points to /<page>
//   *  other languages  -> unchanged, only hreflang fixed
// The runtime side is VITE_ROOT_LANGUAGE=zh (src/js/i18n/i18n.ts and
// src/js/language-redirect.js), so the app treats un-prefixed URLs as zh.
// Also: Chinese title/description/keywords, Baidu mobile meta, static
// Chinese tool links on the home page, sitemap.xml and robots.txt.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(root, 'dist');
const SITE = (process.env.SITE_URL || 'https://pdf.metext.xyz').replace(
  /\/+$/,
  ''
);
const ROOT_LANG = process.env.VITE_ROOT_LANGUAGE || 'en';
const BRAND = '阿搜PDF工具箱';
const BAIDU_VERIFY = (process.env.BAIDU_SITE_VERIFICATION || '').trim();
const LASTMOD =
  process.env.SITEMAP_LASTMOD || new Date().toISOString().slice(0, 10);

if (ROOT_LANG !== 'zh') {
  console.log('[asou-seo] VITE_ROOT_LANGUAGE is not zh, skipping');
  process.exit(0);
}

const LANG_DIRS = fs
  .readdirSync(path.join(root, 'public/locales'))
  .filter((d) =>
    fs.statSync(path.join(root, 'public/locales', d)).isDirectory()
  );
const LANG_RE = new RegExp(
  `^/(?:${LANG_DIRS.map((l) => l.replace('-', '\\-')).join('|')})(?:/|$|[?#])`
);

const zhTools = JSON.parse(
  fs.readFileSync(path.join(root, 'public/locales/zh/tools.json'), 'utf8')
);
const camel = (s) => s.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const esc = (s) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
const unesc = (s) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
const squash = (s) =>
  s.replace(
    /(?<=[A-Za-z0-9]) (?=[\u4e00-\u9fff])|(?<=[\u4e00-\u9fff]) (?=[A-Za-z0-9])/g,
    ''
  );

// ---------------------------------------------------------------- metadata
const HOME = {
  title: `${BRAND} - 免费在线PDF转Word、合并、压缩、拆分，无需上传`,
  description:
    '阿搜PDF工具箱：免费在线PDF工具，支持PDF转Word、PDF合并、PDF压缩、PDF拆分、图片转PDF、PDF转图片等100多种功能。无需注册，文件只在浏览器本地处理，不上传服务器，安全不泄露。',
  keywords:
    'PDF转Word,PDF合并,PDF压缩,PDF拆分,图片转PDF,PDF转图片,PDF转JPG,Word转PDF,在线PDF工具,免费PDF工具,PDF编辑,阿搜PDF工具箱',
};
const LOCAL = '免费在线使用，无需注册，文件只在浏览器本地处理，不上传服务器。';
// Hand-tuned pages for the main keywords.
const OVERRIDES = {
  'pdf-to-word': [
    'PDF转Word在线免费转换 - PDF转DOCX可编辑',
    '在线把PDF转换成可编辑的Word文档（DOCX），保留排版。',
    'PDF转Word,PDF转Word免费,PDF转Word在线,PDF转DOCX,PDF转换成Word',
  ],
  'word-to-pdf': [
    'Word转PDF在线免费转换 - DOCX转PDF',
    '在线把Word文档（DOC/DOCX）转换成PDF。',
    'Word转PDF,Word转PDF免费,DOCX转PDF,在线Word转PDF',
  ],
  'merge-pdf': [
    'PDF合并在线免费 - 多个PDF合并成一个',
    '把多个PDF文件合并成一个PDF，可调整顺序，保留书签。',
    'PDF合并,PDF合并免费,PDF合并在线,多个PDF合并成一个,合并PDF',
  ],
  'compress-pdf': [
    'PDF压缩在线免费 - 减小PDF文件大小',
    '在线压缩PDF，减小PDF文件大小，方便上传和发送邮件。',
    'PDF压缩,PDF压缩免费,PDF压缩在线,压缩PDF大小,PDF变小',
  ],
  'split-pdf': [
    'PDF拆分在线免费 - 按页拆分PDF文件',
    '在线拆分PDF，按页码范围提取或拆分成多个PDF文件。',
    'PDF拆分,PDF拆分免费,PDF拆分在线,拆分PDF,PDF分割',
  ],
  'image-to-pdf': [
    '图片转PDF在线免费 - JPG、PNG转PDF',
    '把JPG、PNG、HEIC、WebP等图片合并转换成PDF。',
    '图片转PDF,图片转PDF免费,JPG转PDF,PNG转PDF,照片转PDF',
  ],
  'jpg-to-pdf': [
    'JPG转PDF在线免费 - 图片转PDF',
    '把一张或多张JPG图片转换成PDF文件。',
    'JPG转PDF,图片转PDF,照片转PDF,JPG转PDF免费',
  ],
  'png-to-pdf': [
    'PNG转PDF在线免费 - 图片转PDF',
    '把PNG图片转换成PDF文件。',
    'PNG转PDF,图片转PDF,PNG转PDF免费',
  ],
  'pdf-to-jpg': [
    'PDF转图片在线免费 - PDF转JPG',
    '把PDF每一页转换成JPG图片。',
    'PDF转图片,PDF转JPG,PDF转图片免费,PDF转换成图片',
  ],
  'pdf-to-png': [
    'PDF转PNG在线免费 - PDF转图片',
    '把PDF每一页转换成高清PNG图片。',
    'PDF转PNG,PDF转图片,PDF转图片免费',
  ],
};

function toolMeta(page, html) {
  if (page === 'index') return HOME;
  const entry = zhTools[camel(page)];
  const name = entry?.name ? squash(entry.name) : null;
  if (OVERRIDES[page]) {
    const [t, d, k] = OVERRIDES[page];
    return {
      title: `${t} | ${BRAND}`,
      description: `${d}${LOCAL}`,
      keywords: `${k},在线PDF工具,${BRAND}`,
      name,
    };
  }
  const title = unesc(html.match(/<title>([^<]*)<\/title>/)?.[1] || '').trim();
  const desc = unesc(
    html.match(/<meta name="description" content="([^"]*)"/)?.[1] || ''
  ).trim();
  const out = { title, description: desc, keywords: null, name };
  if (name) {
    const kw = [name, `${name}在线`, `${name}免费`, `免费${name}`];
    out.keywords =
      [...new Set(kw)].join(',') + `,在线PDF工具,免费PDF工具,${BRAND}`;
    if (!/[\u4e00-\u9fff]/.test(title))
      out.title = `${name} - 免费在线${name} | ${BRAND}`;
    if (!/[\u4e00-\u9fff]/.test(desc) && entry.subtitle)
      out.description = `${entry.subtitle}${LOCAL}`;
    else if (desc && !/不上传|无需上传|本地/.test(desc))
      out.description = `${desc}文件只在浏览器本地处理，不上传服务器。`;
  }
  return out;
}

function setMeta(html, attr, key, value) {
  if (value == null) return html;
  const re = new RegExp(`(<meta ${attr}="${key}" content=")[^"]*(")`);
  return re.test(html)
    ? html.replace(re, `$1${esc(value)}$2`)
    : html.replace(
        /<\/head>/,
        `  <meta ${attr}="${key}" content="${esc(value)}">\n</head>`
      );
}

function applyChineseHead(html, page) {
  const m = toolMeta(page, html);
  html = html.replace(
    /<title>[^<]*<\/title>/,
    `<title>${esc(m.title)}</title>`
  );
  for (const [a, k] of [
    ['name', 'title'],
    ['property', 'og:title'],
    ['name', 'twitter:title'],
  ])
    if (new RegExp(`<meta ${a}="${k}"`).test(html))
      html = setMeta(html, a, k, m.title);
  html = setMeta(html, 'name', 'description', m.description);
  for (const [a, k] of [
    ['property', 'og:description'],
    ['name', 'twitter:description'],
  ])
    if (new RegExp(`<meta ${a}="${k}"`).test(html))
      html = setMeta(html, a, k, m.description);
  if (m.keywords) html = setMeta(html, 'name', 'keywords', m.keywords);
  html = setMeta(html, 'property', 'og:locale', 'zh_CN');
  if (m.name)
    html = setMeta(html, 'name', 'apple-mobile-web-app-title', m.name);
  else if (page === 'index')
    html = setMeta(html, 'name', 'apple-mobile-web-app-title', BRAND);
  html = html.replace(/<html lang="zh"/, '<html lang="zh-CN"');
  // Baidu mobile adaptation + site verification slot
  const baidu = [
    '<meta name="applicable-device" content="pc,mobile">',
    '<meta http-equiv="Cache-Control" content="no-transform">',
    '<meta http-equiv="Cache-Control" content="no-siteapp">',
    BAIDU_VERIFY
      ? `<meta name="baidu-site-verification" content="${esc(BAIDU_VERIFY)}">`
      : '<!-- baidu-site-verification: set BAIDU_SITE_VERIFICATION in asou.env -->',
  ].join('\n    ');
  html = html.replace(/(<meta name="viewport"[^>]*>)/, `$1\n    ${baidu}`);
  return html;
}

// ---------------------------------------------------------------- URLs
const pageUrl = (prefix, page) => {
  const p = page === 'index' ? '' : page;
  return [SITE, prefix, p].filter(Boolean).join('/');
};

// Rebuild the alternate block: zh -> root (zh-CN), en -> /en/, x-default -> root.
function fixHreflang(html) {
  return html.replace(
    /<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g,
    (all, lang, href) => {
      const rest = href.startsWith(SITE) ? href.slice(SITE.length) : null;
      if (rest == null) return all;
      if (lang === 'zh')
        return `<link rel="alternate" hreflang="zh-CN" href="${SITE}${rest.replace(/^\/zh(?=\/|$)/, '')}">`;
      if (lang === 'en' && !/^\/en(\/|$)/.test(rest))
        return `<link rel="alternate" hreflang="en" href="${SITE}/en${rest}">`;
      if (lang === 'x-default')
        return `<link rel="alternate" hreflang="x-default" href="${SITE}${rest.replace(/^\/zh(?=\/|$)/, '')}">`;
      return all;
    }
  );
}

function setCanonical(html, url) {
  return html
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${url}$2`)
    .replace(/(<meta name="twitter:url" content=")[^"]*(")/, `$1${url}$2`);
}

// /zh/... -> / for links and absolute URLs (keeps /zh-TW).
function unprefixZh(html) {
  return html
    .replace(/(href=")\/zh(?:\/|(?="))/g, '$1/')
    .replace(
      new RegExp(`${SITE.replace(/[.]/g, '\\.')}/zh(?=/|"|\\s|<)`, 'g'),
      SITE
    );
}

// English page moved to /en/: prefix internal page links.
function prefixEn(html) {
  return html.replace(/(<a\b[^>]*?\shref=")(\/[^"]*)"/g, (all, pre, href) => {
    if (LANG_RE.test(href)) return all;
    if (
      /^\/(?:assets|images|wasm|locales|pdfjs|libreoffice|workers|docs|blog)(?:\/|$)/.test(
        href
      )
    )
      return all;
    if (/\.(?!html)[a-z0-9]{2,5}(?:[?#]|$)/i.test(href.split(/[?#]/)[0]))
      return all;
    return `${pre}${href === '/' ? '/en' : '/en' + href}"`;
  });
}

// ---------------------------------------------------------------- home tool links
function homeToolLinks(prefix) {
  const partial = path.join(root, 'src/partials/tool-links-static.html');
  if (!fs.existsSync(partial)) return '';
  const main = fs.readFileSync(path.join(root, 'src/js/main.ts'), 'utf8');
  const nameToKey = Object.fromEntries(
    [...main.matchAll(/'([^']+)':\s*'tools:([A-Za-z0-9]+)'/g)].map((m) => [
      m[1],
      m[2],
    ])
  );
  const cats = zhTools.categories || {};
  const catKey = {
    'Popular Tools': 'popularTools',
    'Edit & Annotate': 'editAnnotate',
    'Convert to PDF': 'convertToPdf',
    'Convert from PDF': 'convertFromPdf',
    'Organize & Manage': 'organizeManage',
    'Optimize & Repair': 'optimizeRepair',
    'Secure PDF': 'securePdf',
  };
  const src = fs.readFileSync(partial, 'utf8');
  const seen = new Set();
  let out = '';
  for (const block of src.split(/(?=<div class="col-span-full)/)) {
    const h2 = unesc(block.match(/<h2[^>]*>([^<]*)<\/h2>/)?.[1] || '');
    let links = '';
    for (const m of block.matchAll(
      /<a href="\/([^"]+)"[^>]*><h3[^>]*>([^<]*)<\/h3><p[^>]*>([^<]*)<\/p><\/a>/g
    )) {
      const [, href, enName] = m;
      if (!fs.existsSync(path.join(DIST, `${href}.html`))) continue;
      const key = nameToKey[unesc(enName)] || camel(href);
      const t = zhTools[key];
      if (!t?.name) continue;
      const dup = seen.has(href);
      seen.add(href);
      if (dup && h2 !== 'Popular Tools') continue;
      links += `<a href="${prefix}/${href}" class="block bg-gray-800 p-4 rounded-lg border border-gray-700 hover:bg-gray-700 transition-colors"><h3 class="text-white font-semibold mb-1">${esc(t.name)}</h3><p class="text-gray-400 text-sm">${esc(t.subtitle || '')}</p></a>\n`;
    }
    if (!links) continue;
    out += `<div class="col-span-full mt-6 first:mt-0"><h2 class="text-lg font-semibold text-white">${esc(cats[catKey[h2]] || h2)}</h2></div>\n${links}`;
  }
  return out;
}

function fillToolGrid(html, prefix) {
  const links = homeToolLinks(prefix);
  return links
    ? html.replace(/(<div id="tool-grid"[^>]*>)(<\/div>)/, `$1\n${links}$2`)
    : html;
}

// ---------------------------------------------------------------- img alt
function fixImgAlt(html) {
  return html.replace(/<img\b(?![^>]*\balt=)([^>]*)>/g, (all, attrs) => {
    const logo = /logo|favicon/i.test(attrs);
    return `<img alt="${logo ? BRAND : ''}"${attrs}>`;
  });
}

// ---------------------------------------------------------------- main
if (
  /<html lang="zh-CN"/.test(
    fs.readFileSync(path.join(DIST, 'index.html'), 'utf8')
  )
) {
  console.error('[asou-seo] dist/ already processed; rebuild first');
  process.exit(1);
}
const pages = fs
  .readdirSync(DIST)
  .filter((f) => f.endsWith('.html'))
  .map((f) => f.slice(0, -5));
fs.mkdirSync(path.join(DIST, 'en'), { recursive: true });
const redirectTag = (html) =>
  html.match(/<script[^>]*data-language-redirect[^>]*><\/script>/)?.[0] || '';

let built = 0;
const sitemapPages = [];
for (const page of pages) {
  const enFile = path.join(DIST, `${page}.html`);
  const zhFile = path.join(DIST, 'zh', `${page}.html`);
  if (!fs.existsSync(zhFile)) {
    console.warn(`[asou-seo] no zh version of ${page}, left as is`);
    continue;
  }
  const en = fs.readFileSync(enFile, 'utf8');
  let zh = fs.readFileSync(zhFile, 'utf8');
  const redirect = redirectTag(en);

  // English -> /en/<page>
  let enOut = en.replace(redirect, '');
  enOut = setCanonical(enOut, pageUrl('en', page));
  enOut = fixHreflang(prefixEn(enOut));
  fs.writeFileSync(path.join(DIST, 'en', `${page}.html`), enOut);

  // Chinese head shared by root and /zh/
  zh = fixImgAlt(applyChineseHead(fixHreflang(zh), page));
  const canonical = pageUrl('', page);

  let rootOut = unprefixZh(zh);
  rootOut = setCanonical(rootOut, canonical);
  if (redirect) rootOut = rootOut.replace(/<head>/, `<head>\n    ${redirect}`);
  if (page === 'index') rootOut = fillToolGrid(rootOut, '');
  fs.writeFileSync(enFile, rootOut);

  let zhOut = setCanonical(zh, canonical);
  if (page === 'index') zhOut = fillToolGrid(zhOut, '/zh');
  fs.writeFileSync(zhFile, zhOut);

  if (page !== '404' && !/<meta name="robots" content="noindex/.test(rootOut))
    sitemapPages.push(page);
  built++;
}

// Other languages: only the hreflang block changes.
let relinked = 0;
for (const lang of LANG_DIRS) {
  if (['en', 'zh'].includes(lang)) continue;
  const dir = path.join(DIST, lang);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.html'))) {
    const file = path.join(dir, f);
    const src = fs.readFileSync(file, 'utf8');
    const out = fixHreflang(src);
    if (out !== src) {
      fs.writeFileSync(file, out);
      relinked++;
    }
  }
}

// sitemap.xml: Chinese (root) URLs only.
const prio = (p) =>
  p === 'index'
    ? '1.0'
    : OVERRIDES[p]
      ? '0.9'
      : ['about', 'contact', 'terms', 'privacy', 'licensing'].includes(p)
        ? '0.3'
        : '0.7';
sitemapPages.sort((a, b) =>
  a === 'index'
    ? -1
    : b === 'index'
      ? 1
      : prio(b) - prio(a) || a.localeCompare(b)
);
const urls = sitemapPages
  .map(
    (p) =>
      `  <url>\n    <loc>${pageUrl('', p)}</loc>\n    <lastmod>${LASTMOD}</lastmod>\n    <changefreq>${p === 'index' ? 'daily' : 'weekly'}</changefreq>\n    <priority>${prio(p)}</priority>\n  </url>`
  )
  .join('\n');
fs.writeFileSync(
  path.join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
);

const disallow = [
  '/wasm/',
  '/workers/',
  '/libreoffice-wasm/',
  '/pdfjs-viewer/',
  '/pdfjs-annotation-viewer/',
  '/src/',
  '/*.wasm$',
  '/*.gz$',
];
const block = (ua) =>
  [
    `User-agent: ${ua}`,
    'Allow: /',
    ...disallow.map((d) => `Disallow: ${d}`),
  ].join('\n');
fs.writeFileSync(
  path.join(DIST, 'robots.txt'),
  `# ${BRAND} robots.txt\n# ${SITE}\n\n${block('Baiduspider')}\n\n${block('Baiduspider-mobile')}\n\n${block('*')}\n\nSitemap: ${SITE}/sitemap.xml\n`
);

// h1 audit
const noH1 = sitemapPages.filter(
  (p) =>
    (
      fs
        .readFileSync(path.join(DIST, `${p}.html`), 'utf8')
        .match(/<h1[\s>]/g) || []
    ).length !== 1
);
console.log(
  `[asou-seo] root=zh pages: ${built}, /en pages: ${built}, other-lang hreflang fixed: ${relinked}, sitemap URLs: ${sitemapPages.length}`
);
if (noH1.length)
  console.log(`[asou-seo] pages without exactly one <h1>: ${noH1.join(', ')}`);
