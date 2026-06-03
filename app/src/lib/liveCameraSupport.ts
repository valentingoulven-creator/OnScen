import {
  LIVE_CAMERA_FILE_LOAD_ERROR,
  LIVE_CAMERA_HTTP_LAN_MSDEV_HINT,
  LIVE_CAMERA_HTTPS_HTTP_LAN,
  LIVE_CAMERA_HTTPS_REQUIRED,
  LIVE_CAMERA_IFRAME_BLOCKED,
  LIVE_CAMERA_IFRAME_NOTE,
  LIVE_CAMERA_INVALID_FILE,
  LIVE_CAMERA_PERMISSION_DENIED,
  LIVE_CAMERA_PERMISSION_DENIED_WINDOWS,
  LIVE_CAMERA_PWA_NOTE,
  LIVE_CAMERA_UNSUPPORTED_BROWSER,
} from './liveCameraMessages';

export type LiveCameraPreflightIssue =
  | 'insecure'
  | 'insecure_lan'
  | 'unsupported'
  | 'iframe';

export function isLocalNetworkHost(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') {
    return true;
  }
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  return false;
}

export function isInIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    nav.standalone === true
  );
}

export function isMsdevEnvironment(): boolean {
  return import.meta.env.VITE_APP_ENV === 'msdev';
}

function isWindows(): boolean {
  return typeof navigator !== 'undefined' && /Windows/i.test(navigator.userAgent);
}

function isHttpLocalNetworkPage(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.location.protocol === 'http:' &&
    isLocalNetworkHost(window.location.hostname)
  );
}

/** Erreur bloquante avant getUserMedia, ou null si l’accès caméra peut être tenté. */
export function getLiveCameraPreflightIssue(): LiveCameraPreflightIssue | null {
  if (typeof window === 'undefined') return 'unsupported';

  ensureMediaDevices();
  if (!hasGetUserMediaCapability()) {
    return 'unsupported';
  }

  // Ne pas bloquer sur isSecureContext : Chrome autorise parfois localhost/LAN en HTTP
  // msdev ; la vraie erreur vient de getUserMedia (SecurityError, etc.).
  return null;
}

export function liveCameraPreflightMessage(issue: LiveCameraPreflightIssue): string {
  switch (issue) {
    case 'insecure':
      return LIVE_CAMERA_HTTPS_REQUIRED;
    case 'insecure_lan':
      return LIVE_CAMERA_HTTPS_HTTP_LAN;
    case 'unsupported':
      return LIVE_CAMERA_UNSUPPORTED_BROWSER;
    case 'iframe':
      return LIVE_CAMERA_IFRAME_BLOCKED;
    default:
      return LIVE_CAMERA_UNSUPPORTED_BROWSER;
  }
}

export function getLiveCameraPreflightError(): string | null {
  const issue = getLiveCameraPreflightIssue();
  return issue ? liveCameraPreflightMessage(issue) : null;
}

/** Conseils complémentaires (iframe / PWA / HTTP LAN) pour affichage sous le bouton caméra. */
export function getLiveCameraContextHints(): string[] {
  const hints: string[] = [];
  if (
    isMsdevEnvironment() &&
    typeof window !== 'undefined' &&
    !window.isSecureContext &&
    isHttpLocalNetworkPage()
  ) {
    hints.push(LIVE_CAMERA_HTTP_LAN_MSDEV_HINT);
  }
  if (isInIframe()) hints.push(LIVE_CAMERA_IFRAME_NOTE);
  if (isStandalonePwa()) hints.push(LIVE_CAMERA_PWA_NOTE);
  return hints;
}

type LegacyGetUserMedia = (
  constraints: MediaStreamConstraints,
  onSuccess: (stream: MediaStream) => void,
  onError: (error: Error) => void
) => void;

function getLegacyGetUserMedia(): LegacyGetUserMedia | null {
  if (typeof navigator === 'undefined') return null;
  const nav = navigator as Navigator & {
    getUserMedia?: LegacyGetUserMedia;
    webkitGetUserMedia?: LegacyGetUserMedia;
    mozGetUserMedia?: LegacyGetUserMedia;
  };
  return nav.getUserMedia ?? nav.webkitGetUserMedia ?? nav.mozGetUserMedia ?? null;
}

/** Assure navigator.mediaDevices.getUserMedia (polyfill webkit / anciens Safari). */
export function ensureMediaDevices(): MediaDevices | null {
  if (typeof navigator === 'undefined') return null;

  if (!navigator.mediaDevices) {
    (navigator as Navigator & { mediaDevices?: MediaDevices }).mediaDevices = {} as MediaDevices;
  }

  const md = navigator.mediaDevices;
  if (typeof md.getUserMedia === 'function') return md;

  const legacy = getLegacyGetUserMedia();
  if (!legacy) return null;

  md.getUserMedia = (constraints: MediaStreamConstraints) =>
    new Promise((resolve, reject) => {
      legacy.call(navigator, constraints, resolve, reject);
    });

  return md;
}

export function hasGetUserMediaCapability(): boolean {
  return ensureMediaDevices()?.getUserMedia != null;
}

export const LIVE_CAMERA_CONSTRAINTS_IDEAL: MediaStreamConstraints = {
  audio: true,
  video: {
    facingMode: 'user',
    width: { ideal: 1280 },
    height: { ideal: 720 },
  },
};

export const LIVE_CAMERA_CONSTRAINTS_RELAXED: MediaStreamConstraints = {
  audio: true,
  video: { facingMode: 'user' },
};

export const LIVE_CAMERA_CONSTRAINTS_MINIMAL: MediaStreamConstraints = {
  audio: true,
  video: true,
};

export function mapLiveCameraError(err: unknown): string {
  if (err instanceof DOMException) {
    switch (err.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return isWindows()
          ? LIVE_CAMERA_PERMISSION_DENIED_WINDOWS
          : LIVE_CAMERA_PERMISSION_DENIED;
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return 'Aucune caméra détectée sur cet appareil.';
      case 'NotReadableError':
      case 'TrackStartError':
        return 'La caméra est déjà utilisée par une autre application.';
      case 'OverconstrainedError':
      case 'ConstraintNotSatisfiedError':
        return 'Paramètres caméra non supportés ; réessayez ou choisissez une vidéo fichier.';
      case 'SecurityError':
        if (isHttpLocalNetworkPage()) {
          return isMsdevEnvironment()
            ? LIVE_CAMERA_HTTPS_HTTP_LAN
            : LIVE_CAMERA_HTTPS_REQUIRED;
        }
        return LIVE_CAMERA_HTTPS_REQUIRED;
      case 'AbortError':
        return 'Accès caméra interrompu. Réessayez.';
      case 'NotSupportedError':
        return LIVE_CAMERA_UNSUPPORTED_BROWSER;
      case 'TypeError':
        return LIVE_CAMERA_UNSUPPORTED_BROWSER;
      default:
        if (err.message) return err.message;
    }
  }
  if (err instanceof Error && err.message) return err.message;
  return 'Impossible d’accéder à la caméra.';
}

export function configureLiveVideoElement(el: HTMLVideoElement): void {
  el.muted = true;
  el.playsInline = true;
  el.setAttribute('playsinline', 'true');
  el.setAttribute('webkit-playsinline', 'true');
  el.setAttribute('x5-playsinline', 'true');
}

export async function playLiveVideo(el: HTMLVideoElement): Promise<void> {
  configureLiveVideoElement(el);
  try {
    await el.play();
  } catch {
    /* iOS peut exiger une interaction utilisateur avant play() */
  }
}

export async function acquireLiveCameraStream(
  getUserMedia: (c: MediaStreamConstraints) => Promise<MediaStream>
): Promise<MediaStream> {
  const attempts = [
    LIVE_CAMERA_CONSTRAINTS_IDEAL,
    LIVE_CAMERA_CONSTRAINTS_RELAXED,
    LIVE_CAMERA_CONSTRAINTS_MINIMAL,
  ];
  let lastErr: unknown;
  for (const constraints of attempts) {
    try {
      return await getUserMedia(constraints);
    } catch (e) {
      lastErr = e;
      const name = e instanceof DOMException ? e.name : '';
      if (name !== 'OverconstrainedError' && name !== 'ConstraintNotSatisfiedError') {
        throw e;
      }
    }
  }
  throw lastErr;
}

export function validateLiveVideoFile(file: File): string | null {
  if (!file.type.startsWith('video/') && !/\.(mp4|webm|mov|m4v|ogv)$/i.test(file.name)) {
    return LIVE_CAMERA_INVALID_FILE;
  }
  return null;
}

export function createVideoFileObjectUrl(file: File): string {
  return URL.createObjectURL(file);
}

export async function waitForVideoFileMetadata(el: HTMLVideoElement): Promise<void> {
  if (el.readyState >= 1 && el.videoWidth > 0) return;
  await new Promise<void>((resolve, reject) => {
    const onReady = () => {
      cleanup();
      if (el.videoWidth > 0) resolve();
      else reject(new Error(LIVE_CAMERA_FILE_LOAD_ERROR));
    };
    const onError = () => {
      cleanup();
      reject(new Error(LIVE_CAMERA_FILE_LOAD_ERROR));
    };
    const cleanup = () => {
      el.removeEventListener('loadedmetadata', onReady);
      el.removeEventListener('error', onError);
    };
    el.addEventListener('loadedmetadata', onReady);
    el.addEventListener('error', onError);
    window.setTimeout(() => {
      cleanup();
      reject(new Error(LIVE_CAMERA_FILE_LOAD_ERROR));
    }, 15_000);
  });
}
