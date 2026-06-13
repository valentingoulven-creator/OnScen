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

/** Attend que le flux live expose des dimensions (évite l’aperçu noir au démarrage). */
export async function waitForLiveStreamReady(el: HTMLVideoElement): Promise<void> {
  if (el.readyState >= HTMLMediaElement.HAVE_METADATA && el.videoWidth > 0) return;

  await new Promise<void>((resolve, reject) => {
    const onReady = () => {
      if (el.videoWidth > 0) {
        cleanup();
        resolve();
      }
    };
    const onError = () => {
      cleanup();
      reject(new Error('Camera preview failed'));
    };
    const cleanup = () => {
      el.removeEventListener('loadedmetadata', onReady);
      el.removeEventListener('loadeddata', onReady);
      el.removeEventListener('error', onError);
    };
    el.addEventListener('loadedmetadata', onReady);
    el.addEventListener('loadeddata', onReady);
    el.addEventListener('error', onError);
    window.setTimeout(() => {
      cleanup();
      if (el.srcObject) resolve();
      else reject(new Error('Camera preview timeout'));
    }, 3000);
  });
}

/** Branche un flux getUserMedia sur l’élément vidéo et démarre la lecture. */
export async function attachLiveCameraStream(
  el: HTMLVideoElement,
  stream: MediaStream
): Promise<void> {
  configureLiveVideoElement(el);
  if (el.src) el.removeAttribute('src');
  if (el.srcObject !== stream) {
    el.srcObject = stream;
  }
  await waitForLiveStreamReady(el);
  await playLiveVideo(el);
}

export type LiveRemotePlaybackResult = 'playing' | 'muted_fallback' | 'failed';

/** Force re-bind MediaStream on video element (required when tracks are added later). */
export function forceAttachLiveRemoteStream(el: HTMLVideoElement, stream: MediaStream): void {
  if (el.src) el.removeAttribute('src');
  el.srcObject = null;
  el.srcObject = stream;
  for (const track of stream.getVideoTracks()) {
    track.enabled = true;
  }
}

/** Lecture flux distant (spectateur) — tente le son, signale si le navigateur impose le muet. */
export async function playLiveRemoteVideo(el: HTMLVideoElement): Promise<LiveRemotePlaybackResult> {
  el.playsInline = true;
  el.setAttribute('playsinline', 'true');
  el.setAttribute('webkit-playsinline', 'true');
  el.setAttribute('x5-playsinline', 'true');
  if (el.src) el.removeAttribute('src');
  await Promise.race([
    waitForLiveStreamReady(el).catch(() => undefined),
    new Promise<void>((resolve) => window.setTimeout(resolve, 400)),
  ]);
  el.muted = false;
  if ('volume' in el) el.volume = 1;
  try {
    await el.play();
    return 'playing';
  } catch {
    try {
      el.muted = true;
      await el.play();
      return 'muted_fallback';
    } catch {
      return 'failed';
    }
  }
}

/** Débloque le son du flux distant après un geste utilisateur. */
export async function unmuteLiveRemoteVideo(
  el: HTMLVideoElement,
  stream?: MediaStream | null
): Promise<boolean> {
  if (stream) forceAttachLiveRemoteStream(el, stream);
  await Promise.race([
    waitForLiveStreamReady(el).catch(() => undefined),
    new Promise<void>((resolve) => window.setTimeout(resolve, 400)),
  ]);
  el.muted = false;
  if ('volume' in el) el.volume = 1;
  try {
    await el.play();
    return true;
  } catch {
    return false;
  }
}

export interface LiveMediaDeviceOption {
  deviceId: string;
  label: string;
}

export async function listLiveAudioInputDevices(): Promise<LiveMediaDeviceOption[]> {
  const md = ensureMediaDevices();
  if (!md?.enumerateDevices) return [];
  const all = await md.enumerateDevices();
  return all
    .filter((d) => d.kind === 'audioinput')
    .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Micro ${i + 1}` }));
}

/** Remplace la piste audio d'un flux live sans couper la vidéo. */
export async function replaceLiveAudioTrack(
  stream: MediaStream,
  getUserMedia: (c: MediaStreamConstraints) => Promise<MediaStream>,
  audioDeviceId: string
): Promise<MediaStreamTrack> {
  const audioStream = await getUserMedia({
    audio: { deviceId: { ideal: audioDeviceId } },
    video: false,
  });
  const newTrack = audioStream.getAudioTracks()[0];
  if (!newTrack) {
    audioStream.getTracks().forEach((t) => t.stop());
    throw new DOMException('No audio track', 'NotFoundError');
  }
  const oldTrack = stream.getAudioTracks()[0];
  if (oldTrack) {
    stream.removeTrack(oldTrack);
    oldTrack.stop();
  }
  stream.addTrack(newTrack);
  audioStream.getTracks().forEach((t) => {
    if (t !== newTrack) t.stop();
  });
  return newTrack;
}

export interface LiveCameraDevicePrefs {
  videoDeviceId?: string;
  audioDeviceId?: string;
}

export function buildLiveCameraConstraintAttempts(
  prefs?: LiveCameraDevicePrefs | null
): MediaStreamConstraints[] {
  if (!prefs?.videoDeviceId && !prefs?.audioDeviceId) {
    return [
      LIVE_CAMERA_CONSTRAINTS_IDEAL,
      LIVE_CAMERA_CONSTRAINTS_RELAXED,
      LIVE_CAMERA_CONSTRAINTS_MINIMAL,
    ];
  }

  const audioExact = prefs.audioDeviceId ? { deviceId: { exact: prefs.audioDeviceId } } : true;
  const audioIdeal = prefs.audioDeviceId ? { deviceId: { ideal: prefs.audioDeviceId } } : true;
  const videoExact = prefs.videoDeviceId
    ? {
        deviceId: { exact: prefs.videoDeviceId },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      }
    : { facingMode: 'user' as const, width: { ideal: 1280 }, height: { ideal: 720 } };
  const videoIdeal = prefs.videoDeviceId
    ? {
        deviceId: { ideal: prefs.videoDeviceId },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      }
    : { facingMode: 'user' as const, width: { ideal: 1280 }, height: { ideal: 720 } };
  const videoRelaxed = prefs.videoDeviceId
    ? { deviceId: { ideal: prefs.videoDeviceId } }
    : { facingMode: 'user' as const };

  return [
    { video: videoExact, audio: audioExact },
    { video: videoIdeal, audio: audioIdeal },
    { video: videoRelaxed, audio: audioIdeal },
    { video: prefs.videoDeviceId ? { deviceId: { ideal: prefs.videoDeviceId } } : true, audio: audioIdeal },
  ];
}

export async function acquireLiveCameraStream(
  getUserMedia: (c: MediaStreamConstraints) => Promise<MediaStream>,
  prefs?: LiveCameraDevicePrefs | null
): Promise<MediaStream> {
  const attempts = buildLiveCameraConstraintAttempts(prefs);
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
