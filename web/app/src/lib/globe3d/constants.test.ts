import { describe, expect, it, vi, afterEach } from 'vitest';
import { getGlobeTexturePaths, globeAssetPath, resolveGlobeAssetBase } from './constants';

describe('globeAssetPath', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves /tel/ from pathname when BASE_URL is / (apptel dev proxy)', () => {
    vi.stubGlobal('window', {
      location: { href: 'http://localhost:4082/tel/', pathname: '/tel/' },
    });
    expect(resolveGlobeAssetBase()).toBe('/tel/');
    expect(globeAssetPath('globe/earth-blue-marble.jpg')).toBe(
      'http://localhost:4082/tel/globe/earth-blue-marble.jpg'
    );
  });

  it('resolves absolute URL under / base (web)', () => {
    vi.stubGlobal('window', {
      location: { href: 'http://localhost:5173/', pathname: '/' },
    });
    expect(getGlobeTexturePaths().day).toBe(
      'http://localhost:5173/globe/earth-blue-marble.jpg'
    );
  });

  it('resolves relative Capacitor bundle (base ./)', () => {
    vi.stubEnv('BASE_URL', './');
    vi.stubGlobal('window', {
      location: {
        href: 'https://onscen.com/index.html',
        pathname: '/index.html',
      },
    });
    expect(globeAssetPath('globe/earth-blue-marble.jpg')).toBe(
      'https://onscen.com/globe/earth-blue-marble.jpg'
    );
  });
});
