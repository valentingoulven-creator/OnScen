import { describe, expect, it, vi } from 'vitest';
import {
  buildLiveCameraConstraintAttempts,
  canBypassLiveMediaSetup,
  configureInlinePlaybackVideo,
  getLiveCameraPreflightIssue,
  isLocalNetworkHost,
  liveCameraPreflightMessage,
  mapLiveCameraError,
  validateLiveVideoFile,
} from './liveCameraSupport';

describe('canBypassLiveMediaSetup', () => {
  it('autorise le contournement en msdev ou Vite dev', () => {
    vi.stubEnv('VITE_APP_ENV', 'msdev');
    expect(canBypassLiveMediaSetup()).toBe(true);
    vi.unstubAllEnvs();
  });
});

describe('isLocalNetworkHost', () => {
  it('accepte localhost et LAN privé', () => {
    expect(isLocalNetworkHost('localhost')).toBe(true);
    expect(isLocalNetworkHost('127.0.0.1')).toBe(true);
    expect(isLocalNetworkHost('192.168.0.42')).toBe(true);
    expect(isLocalNetworkHost('10.0.0.1')).toBe(true);
    expect(isLocalNetworkHost('172.16.0.1')).toBe(true);
  });

  it('refuse les hôtes publics', () => {
    expect(isLocalNetworkHost('onscen.app')).toBe(false);
    expect(isLocalNetworkHost('8.8.8.8')).toBe(false);
  });
});

describe('getLiveCameraPreflightIssue', () => {
  it('ne bloque pas sur http LAN (tentative getUserMedia)', () => {
    const original = globalThis.window;
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        isSecureContext: false,
        location: { hostname: '192.168.1.93', protocol: 'http:' },
      },
    });
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        mediaDevices: {
          getUserMedia: () => Promise.resolve(new MediaStream()),
        },
      },
    });
    expect(getLiveCameraPreflightIssue()).toBeNull();
    Object.defineProperty(globalThis, 'window', { configurable: true, value: original });
  });
});

describe('liveCameraPreflightMessage', () => {
  it('retourne un message FR pour chaque code', () => {
    expect(liveCameraPreflightMessage('insecure')).toMatch(/HTTPS/i);
    expect(liveCameraPreflightMessage('insecure_lan')).toMatch(/réseau local/i);
    expect(liveCameraPreflightMessage('unsupported')).toMatch(/navigateur/i);
  });
});

describe('mapLiveCameraError', () => {
  it('mappe NotAllowedError en français', () => {
    const err = new DOMException('denied', 'NotAllowedError');
    expect(mapLiveCameraError(err)).toMatch(/refusé/i);
  });

  it('mentionne les paramètres Windows pour NotAllowedError', () => {
    const ua = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    });
    const err = new DOMException('denied', 'NotAllowedError');
    expect(mapLiveCameraError(err)).toMatch(/Windows/i);
    expect(mapLiveCameraError(err)).toMatch(/Confidentialité/i);
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: ua });
  });

  it('mappe SecurityError vers HTTPS', () => {
    const err = new DOMException('insecure', 'SecurityError');
    expect(mapLiveCameraError(err)).toMatch(/HTTPS/i);
  });
});

describe('buildLiveCameraConstraintAttempts', () => {
  it('utilise exact deviceId quand une caméra est choisie', () => {
    const attempts = buildLiveCameraConstraintAttempts({
      videoDeviceId: 'cam-123',
      audioDeviceId: 'mic-456',
    });
    expect(attempts[0]?.video).toMatchObject({
      deviceId: { exact: 'cam-123' },
    });
    expect(attempts[0]?.audio).toEqual({ deviceId: { exact: 'mic-456' } });
  });

  it('conserve facingMode sans prefs explicites', () => {
    const attempts = buildLiveCameraConstraintAttempts(null);
    expect(attempts[0]?.video).toMatchObject({ facingMode: 'user' });
  });
});

describe('validateLiveVideoFile', () => {
  it('accepte video/*', () => {
    const f = new File([], 'clip.mp4', { type: 'video/mp4' });
    expect(validateLiveVideoFile(f)).toBeNull();
  });

  it('rejette les non-vidéos', () => {
    const f = new File([], 'photo.jpg', { type: 'image/jpeg' });
    expect(validateLiveVideoFile(f)).toMatch(/vidéo/i);
  });
});

describe('configureInlinePlaybackVideo', () => {
  it('applique playsinline / webkit-playsinline (Safari iPhone)', () => {
    const attrs: Record<string, string> = {};
    const el = {
      playsInline: false,
      setAttribute(k: string, v: string) {
        attrs[k] = v;
      },
      getAttribute(k: string) {
        return attrs[k] ?? null;
      },
    } as unknown as HTMLVideoElement;
    configureInlinePlaybackVideo(el);
    expect(el.playsInline).toBe(true);
    expect(attrs['webkit-playsinline']).toBe('true');
  });
});
