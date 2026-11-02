import { describe, it, expect, vi } from 'vitest';
import { onPageReady } from '../js/i18n/i18n';

describe('onPageReady', () => {
  it('runs the callback once translations and the DOM are ready', async () => {
    const callback = vi.fn();
    onPageReady(callback);
    await vi.waitFor(() => expect(callback).toHaveBeenCalledTimes(1));
  });

  it('runs every registered callback exactly once', async () => {
    const first = vi.fn();
    const second = vi.fn();
    onPageReady(first);
    onPageReady(second);
    await vi.waitFor(() => {
      expect(first).toHaveBeenCalledTimes(1);
      expect(second).toHaveBeenCalledTimes(1);
    });
  });
});

describe('onPageReady file drops', () => {
  it('keeps the browser from opening a dropped file until the page is ready', async () => {
    let ready = false;
    onPageReady(() => {
      ready = true;
    });
    const early = new Event('drop', { cancelable: true });
    window.dispatchEvent(early);
    expect(ready).toBe(false);
    expect(early.defaultPrevented).toBe(true);

    await vi.waitFor(() => expect(ready).toBe(true));
    const late = new Event('drop', { cancelable: true });
    window.dispatchEvent(late);
    expect(late.defaultPrevented).toBe(false);
  });
});

describe('onPageReady early file selection', () => {
  it('replays a file picked before the page listeners were attached', async () => {
    vi.resetModules();
    const { onPageReady } = await import('../js/i18n/i18n');
    document.body.innerHTML = '<input type="file" id="file-input">';
    const input = document.getElementById('file-input') as HTMLInputElement;
    const file = new File(['%PDF-1.4'], 'a.pdf', { type: 'application/pdf' });
    Object.defineProperty(input, 'files', { value: [file] });
    const seen = vi.fn();
    onPageReady(() => {
      input.addEventListener('change', seen);
    });
    // The user picks a file before translations finish loading.
    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(seen).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(seen).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 20));
    expect(seen).toHaveBeenCalledTimes(1);
  });
});
