import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isCompactMapViewport,
  isPhoneWebViewport,
  isTouchCoarseViewport,
} from './phoneViewport';

function stubWindow(width: number, mediaMatches: Record<string, boolean>) {
  vi.stubGlobal('window', {
    innerWidth: width,
    matchMedia: (query: string) => ({
      matches: mediaMatches[query] ?? false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
}

describe('phoneViewport', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('isTouchCoarseViewport détecte iPhone UA', () => {
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });
    stubWindow(390, {});
    expect(isTouchCoarseViewport()).toBe(true);
  });

  it('isPhoneWebViewport true sur max-width 430px', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0' });
    stubWindow(390, { '(max-width: 430px)': true, '(max-width: 767px) and (pointer: coarse)': false });
    expect(isPhoneWebViewport()).toBe(true);
  });

  it('isPhoneWebViewport false sur desktop', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0' });
    stubWindow(1280, { '(max-width: 430px)': false, '(max-width: 767px) and (pointer: coarse)': false });
    expect(isPhoneWebViewport()).toBe(false);
  });

  it('isCompactMapViewport true sur 390px', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0' });
    stubWindow(390, {
      '(max-width: 430px)': true,
      '(max-width: 767px) and (pointer: coarse)': false,
      '(max-width: 639px)': true,
    });
    expect(isCompactMapViewport()).toBe(true);
  });
});
