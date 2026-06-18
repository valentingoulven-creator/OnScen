import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  canUseGlobeView,
  detectWebGLSupport,
  disableGlobeView,
  GLOBE_UNAVAILABLE_EVENT,
  invalidateWebGLSupportCache,
  isWebGLError,
  isWebGLSupported,
  shouldForceFlatMap,
} from './webglSupport';

function installStorageMock(): void {
  const store = new Map<string, string>();
  const storage = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
  vi.stubGlobal('sessionStorage', storage);
  vi.stubGlobal('localStorage', storage);
}

function installBrowserGlobals(): void {
  installStorageMock();
  const listeners = new Map<string, Set<() => void>>();
  vi.stubGlobal('window', {
    addEventListener: (type: string, listener: () => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(listener);
    },
    removeEventListener: (type: string, listener: () => void) => {
      listeners.get(type)?.delete(listener);
    },
    dispatchEvent: (event: { type: string }) => {
      listeners.get(event.type)?.forEach((listener) => listener());
      return true;
    },
  });
  vi.stubGlobal(
    'CustomEvent',
    class CustomEvent {
      type: string;
      constructor(type: string) {
        this.type = type;
      }
    }
  );
}

describe('isWebGLError', () => {
  it('detects Three.js WebGL context errors', () => {
    expect(isWebGLError(new Error('Error creating WebGL context.'))).toBe(true);
    expect(
      isWebGLError(new Error('Error creating WebGL context with your selected attributes.'))
    ).toBe(true);
    expect(isWebGLError('Failed to initialize WebGL')).toBe(true);
    expect(isWebGLError(new Error('Leaflet map error'))).toBe(false);
  });
});

describe('canUseGlobeView', () => {
  beforeEach(() => {
    installStorageMock();
    invalidateWebGLSupportCache();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is false after disableGlobeView for the session', () => {
    expect(canUseGlobeView()).toBe(isWebGLSupported());
    disableGlobeView();
    expect(shouldForceFlatMap()).toBe(true);
    expect(canUseGlobeView()).toBe(false);
  });
});

describe('disableGlobeView', () => {
  beforeEach(() => {
    installBrowserGlobals();
    invalidateWebGLSupportCache();
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('dispatches GLOBE_UNAVAILABLE_EVENT once', () => {
    let count = 0;
    const handler = () => {
      count += 1;
    };
    window.addEventListener(GLOBE_UNAVAILABLE_EVENT, handler);
    disableGlobeView();
    disableGlobeView();
    window.removeEventListener(GLOBE_UNAVAILABLE_EVENT, handler);
    expect(count).toBe(1);
    expect(localStorage.getItem('soundly_map_style')).toBe('flat');
  });
});

describe('detectWebGLSupport', () => {
  beforeEach(() => {
    invalidateWebGLSupportCache();
  });

  it('returns a stable cached result', () => {
    const first = detectWebGLSupport();
    const second = detectWebGLSupport();
    expect(second).toBe(first);
  });

  it('does not throw in jsdom', () => {
    expect(() => isWebGLSupported()).not.toThrow();
    expect(typeof isWebGLSupported()).toBe('boolean');
  });
});
