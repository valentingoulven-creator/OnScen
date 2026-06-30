import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  canPlayNativeHls,
  isIosMobileSafari,
  isIpadSafari,
  isSafariBrowser,
  shouldUseNativeHls,
} from './safariPlayback';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');

describe('safariPlayback', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('détecte Safari iOS', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    expect(isIosMobileSafari(ua)).toBe(true);
    expect(isSafariBrowser(ua)).toBe(true);
  });

  it('exclut Chrome iOS (CriOS)', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1';
    expect(isSafariBrowser(ua)).toBe(false);
  });

  it('détecte iPadOS desktop UA', () => {
    const ua =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
    expect(isIpadSafari(ua, 5)).toBe(true);
    expect(isIpadSafari(ua, 0)).toBe(false);
  });

  it('shouldUseNativeHls sur iPhone avec HLS natif', () => {
    vi.stubGlobal('document', {
      createElement: () => ({
        canPlayType: (t: string) => (t.includes('mpegurl') ? 'probably' : ''),
      }),
    });
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    const video = { canPlayType: (t: string) => (t.includes('mpegurl') ? 'probably' : '') } as HTMLVideoElement;
    expect(canPlayNativeHls(video)).toBe(true);
    expect(shouldUseNativeHls(ua)).toBe(true);
  });

  it('shouldUseNativeHls false sur Chrome Android', () => {
    const ua =
      'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
    expect(shouldUseNativeHls(ua)).toBe(false);
  });
});

describe('index.html mobile / Safari', () => {
  it('viewport-fit=cover pour encoche iOS', () => {
    const html = readFileSync(join(appRoot, 'index.html'), 'utf8');
    expect(html).toMatch(/viewport-fit=cover/);
    expect(html).toMatch(/interactive-widget=resizes-content/);
    expect(html).toMatch(/apple-mobile-web-app-capable/);
    expect(html).toMatch(/100dvh/);
    expect(html).toMatch(/-webkit-fill-available/);
  });
});
