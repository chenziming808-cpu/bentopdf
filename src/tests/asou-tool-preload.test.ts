import { describe, it, expect } from 'vitest';
import {
  toolKeyForPath,
  filesForTool,
  type PreloadManifest,
} from '../js/utils/asou-tool-preload';

const manifest: PreloadManifest = {
  version: 1,
  groups: {
    pdfjs: [{ url: '/assets/pdf.worker-x.js', size: 10 }],
    pymupdf: [
      { url: '/wasm/pymupdf/dist/index.js', size: 1 },
      { url: '/wasm/pymupdf/assets/a.whl', size: 100 },
    ],
    'hyper-compress': [{ url: '/assets/hyper-compress-x.wasm', size: 7 }],
    cpdf: [{ url: '/wasm/cpdf/coherentpdf.browser.min.js', size: 5 }],
    qpdf: [{ url: '/qpdf.wasm', size: 3 }],
    'ocr-worker': [{ url: '/wasm/ocr/worker.min.js', size: 1 }],
    'ocr-core': [
      { url: '/wasm/ocr/core/tesseract-core-lstm.wasm.js', size: 4 },
      { url: '/wasm/ocr/core/tesseract-core-simd-lstm.wasm.js', size: 4 },
    ],
    'ocr-chi_sim': [
      { url: '/wasm/ocr/lang-data/chi_sim.traineddata.gz', size: 2 },
    ],
    'ocr-font-sc': [
      { url: '/wasm/ocr/fonts/NotoSansCJKsc-Regular.otf', size: 16 },
    ],
  },
};

describe('asou tool preload', () => {
  it('maps tool pages (incl. locale and variant pages) to preload keys', () => {
    expect(toolKeyForPath('/pdf-to-word.html')).toBe('pdf-to-word');
    expect(toolKeyForPath('/en/pdf-to-word')).toBe('pdf-to-word');
    expect(toolKeyForPath('/compress-pdf-to-1mb.html')).toBe('compress-pdf');
    expect(toolKeyForPath('/compress-pdf-for-email.html')).toBe('compress-pdf');
    expect(toolKeyForPath('/merge-pdf.html')).toBe('merge-pdf');
    expect(toolKeyForPath('/ocr-pdf.html')).toBe('ocr-pdf');
  });

  it('never preloads on the home page or unrelated pages', () => {
    expect(toolKeyForPath('/')).toBeNull();
    expect(toolKeyForPath('/index.html')).toBeNull();
    expect(toolKeyForPath('/en/')).toBeNull();
    expect(toolKeyForPath('/rotate-pdf.html')).toBeNull();
  });

  it('collects the files of one tool in order without duplicates', () => {
    const urls = filesForTool(manifest, 'pdf-to-word').map((f) => f.url);
    expect(urls).toEqual([
      '/assets/pdf.worker-x.js',
      '/wasm/pymupdf/dist/index.js',
      '/wasm/pymupdf/assets/a.whl',
    ]);
  });

  it('picks exactly one OCR core variant', () => {
    const files = filesForTool(manifest, 'ocr-pdf', (f) =>
      f.url.endsWith('/tesseract-core-simd-lstm.wasm.js')
    );
    const cores = files.filter((f) => f.url.includes('tesseract-core'));
    expect(cores.map((f) => f.url)).toEqual([
      '/wasm/ocr/core/tesseract-core-simd-lstm.wasm.js',
    ]);
    expect(files.some((f) => f.url.endsWith('chi_sim.traineddata.gz'))).toBe(
      true
    );
  });
});
