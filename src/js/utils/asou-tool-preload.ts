/**
 * 阿搜PDF工具箱: warm the browser cache with the heavy runtime files a tool
 * page needs (PyMuPDF / Pyodide wheels, Tesseract, cpdf, hyper-compress ...)
 * as soon as the tool page opens, instead of waiting for the user to pick a
 * file and press the button. Only the files of the *current* tool are fetched
 * (never on the home page) and a small progress card tells the user that the
 * first run is downloading, not stuck.
 *
 * The file list and sizes come from /wasm/asou-preload.json, generated at
 * build time by scripts/asou-preload-manifest.mjs.
 */

export interface PreloadFile {
  url: string;
  size: number;
}

export interface PreloadManifest {
  version: number;
  groups: Record<string, PreloadFile[]>;
}

/** Tool page slug -> manifest groups to warm (order = download order). */
export const TOOL_PRELOAD_GROUPS: Record<string, string[]> = {
  'pdf-to-word': ['pdfjs', 'pymupdf'],
  'pdf-to-excel': ['pdfjs', 'pymupdf'],
  'compress-pdf': ['hyper-compress'],
  'merge-pdf': ['pdfjs', 'cpdf'],
  'ocr-pdf': [
    'pdfjs',
    'qpdf',
    'ocr-worker',
    'ocr-core',
    'ocr-chi_sim',
    'ocr-font-sc',
  ],
};

const TOOL_LABELS_ZH: Record<string, string> = {
  'pdf-to-word': 'PDF转Word',
  'pdf-to-excel': 'PDF转Excel',
  'compress-pdf': 'PDF压缩',
  'merge-pdf': 'PDF合并',
  'ocr-pdf': 'OCR文字识别',
};

// Card copy: deliberately Chinese-only (the card is only shown on zh pages).
const ZH_TEXT = {
  hint: '首次使用需下载，之后会缓存，可以先选择文件',
  ready: '✓ 组件已就绪，转换会更快',
};

export const MANIFEST_URL = '/wasm/asou-preload.json';

/** "/en/compress-pdf-to-1mb.html" -> "compress-pdf" (tool key) or null. */
export function toolKeyForPath(pathname: string): string | null {
  const slug = pathname
    .replace(/\/+$/, '')
    .split('/')
    .pop()!
    .replace(/\.html$/, '');
  if (!slug) return null;
  if (TOOL_PRELOAD_GROUPS[slug]) return slug;
  if (/^compress-pdf(?:-|$)/.test(slug)) return 'compress-pdf';
  return null;
}

/** Pick the manifest files for a tool; the OCR core variant is chosen by
 * the caller-supplied predicate (mirrors tesseract.js getCore). */
export function filesForTool(
  manifest: PreloadManifest,
  tool: string,
  pickCore: (file: PreloadFile) => boolean = () => true
): PreloadFile[] {
  const seen = new Set<string>();
  const out: PreloadFile[] = [];
  for (const group of TOOL_PRELOAD_GROUPS[tool] || []) {
    let files = manifest.groups[group] || [];
    if (group === 'ocr-core') files = files.filter(pickCore).slice(0, 1);
    for (const f of files) {
      if (seen.has(f.url)) continue;
      seen.add(f.url);
      out.push(f);
    }
  }
  return out;
}

async function ocrCorePicker(): Promise<(f: PreloadFile) => boolean> {
  let variant = '';
  try {
    const { simd, relaxedSimd } = await import('wasm-feature-detect');
    if (await relaxedSimd()) variant = '-relaxedsimd';
    else if (await simd()) variant = '-simd';
  } catch {
    /* plain build */
  }
  // OEM LSTM_ONLY (tesseract.js default) -> *-lstm.wasm.js
  const name = `tesseract-core${variant}-lstm.wasm.js`;
  return (f) => f.url.endsWith('/' + name);
}

function shouldSkip(): boolean {
  const conn = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;
  if (conn?.saveData) return true;
  if (conn?.effectiveType && /(^|-)2g$/.test(conn.effectiveType)) return true;
  return false;
}

interface Card {
  update(pct: number): void;
  done(): void;
  remove(): void;
}

function createCard(tool: string): Card {
  const label = TOOL_LABELS_ZH[tool] || '';
  const el = document.createElement('div');
  el.id = 'asou-preload-card';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.style.cssText =
    'position:fixed;right:16px;bottom:16px;z-index:60;max-width:300px;' +
    'background:rgba(31,41,55,.96);color:#e5e7eb;border:1px solid #4b5563;' +
    'border-radius:12px;padding:10px 14px;font-size:13px;line-height:1.5;' +
    'box-shadow:0 8px 24px rgba(0,0,0,.35);transition:opacity .4s';
  const text = document.createElement('div');
  const bar = document.createElement('div');
  bar.style.cssText =
    'height:4px;background:#374151;border-radius:2px;margin-top:6px;overflow:hidden';
  const fill = document.createElement('div');
  fill.style.cssText =
    'height:100%;width:0;background:#6366f1;transition:width .3s';
  bar.appendChild(fill);
  const hint = document.createElement('div');
  hint.style.cssText = 'font-size:12px;color:#9ca3af;margin-top:4px';
  hint.textContent = ZH_TEXT.hint;
  el.append(text, bar, hint);
  const prefix = `正在准备${label ? '「' + label + '」' : ''}组件`;
  text.textContent = `${prefix}… 0%`;
  document.body.appendChild(el);
  return {
    update(pct) {
      const p = Math.max(0, Math.min(99, Math.floor(pct)));
      text.textContent = `${prefix}… ${p}%`;
      fill.style.width = `${p}%`;
    },
    done() {
      text.textContent = ZH_TEXT.ready;
      fill.style.width = '100%';
      hint.remove();
      setTimeout(() => {
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 500);
      }, 2500);
    },
    remove() {
      el.remove();
    },
  };
}

async function fetchWithProgress(
  file: PreloadFile,
  onBytes: (n: number) => void
): Promise<void> {
  const res = await fetch(file.url, { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`${res.status} ${file.url}`);
  if (!res.body) {
    const buf = await res.arrayBuffer();
    onBytes(buf.byteLength);
    return;
  }
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    onBytes(value.byteLength);
  }
}

let started = false;

/**
 * On a first visit the service worker is still installing when the page
 * loads. Wait (briefly) until it controls the page so the preload goes
 * through its cache + in-flight dedup and the tool reuses the same download.
 */
/**
 * Tool pages do not load sw-register (it lives in the home entry), so on a
 * first visit straight to a tool page nothing would control the page and the
 * preload and the tool's own loader would download the same files twice. Make
 * sure the service worker is registered (same /sw.js, it claims clients on
 * activate) and wait until it controls the page, so both requests go through
 * its in-flight de-duplication and cache.
 */
function waitForServiceWorker(timeoutMs = 5000): Promise<void> {
  const sw = navigator.serviceWorker;
  if (!sw || sw.controller) return Promise.resolve();
  const loc = window.location;
  const dev =
    loc.hostname === 'localhost' ||
    loc.hostname === '127.0.0.1' ||
    loc.port !== '';
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    sw.addEventListener(
      'controllerchange',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
    if (dev) return;
    sw.getRegistration()
      .then(
        (reg) => reg || sw.register(`${import.meta.env.BASE_URL || '/'}sw.js`)
      )
      .catch((): null => null);
  });
}

export async function startToolPreload(
  pathname = window.location.pathname
): Promise<void> {
  if (started) return;
  const tool = toolKeyForPath(pathname);
  if (!tool || shouldSkip()) return;
  started = true;
  await waitForServiceWorker();

  let manifest: PreloadManifest;
  try {
    // ?t= keeps the service worker from caching the manifest forever
    const res = await fetch(`${MANIFEST_URL}?t=${Date.now()}`, {
      cache: 'no-cache',
    });
    if (!res.ok) return;
    manifest = (await res.json()) as PreloadManifest;
  } catch {
    return;
  }
  const pick = TOOL_PRELOAD_GROUPS[tool].includes('ocr-core')
    ? await ocrCorePicker()
    : undefined;
  const files = filesForTool(manifest, tool, pick);
  if (!files.length) return;

  const total = files.reduce((s, f) => s + f.size, 0) || 1;
  let loaded = 0;
  let card: Card | null = null;
  // Progress card is Chinese-only (the site's main audience); other locales
  // still get the silent background download. Only show it if the files are
  // not served instantly from cache.
  const zh = (document.documentElement.lang || 'zh')
    .toLowerCase()
    .startsWith('zh');
  const showTimer = setTimeout(() => {
    if (!zh) return;
    card = createCard(tool);
    card.update((loaded / total) * 100);
  }, 700);

  const queue = [...files];
  let failed = false;
  const worker = async () => {
    for (let f = queue.shift(); f; f = queue.shift()) {
      const file = f;
      let got = 0;
      try {
        await fetchWithProgress(file, (n) => {
          // never count more than the expected size for this file
          loaded += Math.max(0, Math.min(n, file.size - got));
          got += n;
          card?.update((loaded / total) * 100);
        });
      } catch (e) {
        failed = true;
        console.warn('[asou-preload]', e);
      }
      if (got < file.size) loaded += file.size - got;
      card?.update((loaded / total) * 100);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  clearTimeout(showTimer);
  if (card) {
    if (failed) (card as Card).remove();
    else (card as Card).done();
  }
  console.log(`[asou-preload] ${tool}: ${files.length} files warmed`);
}

export function scheduleToolPreload(): void {
  if (!toolKeyForPath(window.location.pathname)) return;
  const run = (): void => {
    void startToolPreload();
  };
  if (typeof window.requestIdleCallback === 'function') {
    requestIdleCallback(run, { timeout: 1500 });
  } else {
    setTimeout(run, 300);
  }
}
