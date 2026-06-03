/** Durée max d'enregistrement (msdev : tenir dans le JSON 2 Mo). */
export const REEL_RECORD_MAX_SEC = 30;

/** Taille max estimée du corps POST (express.json 2 Mo). */
export const REEL_UPLOAD_JSON_LIMIT_BYTES = 2 * 1024 * 1024;

/** Marge pour métadonnées JSON hors data URLs. */
export const REEL_UPLOAD_PAYLOAD_MARGIN_BYTES = 120_000;

export const REEL_RECORD_VIDEO_BITS_PER_SEC = 250_000;
export const REEL_RECORD_AUDIO_BITS_PER_SEC = 32_000;

export function pickRecorderMimeType(): string {
  const candidates = ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/webm'];
  for (const mime of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }
  return 'video/webm';
}

export function cameraErrorMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : '';
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'Accès à la caméra refusé. Autorisez la caméra et le micro dans les paramètres du navigateur.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'Aucune caméra détectée sur cet appareil.';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'La caméra est utilisée par une autre application.';
    case 'OverconstrainedError':
      return 'La caméra ne prend pas en charge les paramètres demandés.';
    case 'SecurityError':
      return 'La caméra n’est pas disponible (connexion non sécurisée ou contexte bloqué).';
    default:
      return err instanceof Error ? err.message : 'Impossible d’accéder à la caméra.';
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Lecture de la vidéo impossible'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Lecture de la vidéo impossible'));
    reader.readAsDataURL(blob);
  });
}

/** Image JPEG réduite pour poster (data URL). */
export function captureVideoPosterDataUrl(
  video: HTMLVideoElement,
  maxWidth = 480,
  quality = 0.72
): string | null {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return null;
  const scale = Math.min(1, maxWidth / w);
  const cw = Math.round(w * scale);
  const ch = Math.round(h * scale);
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, cw, ch);
  try {
    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return null;
  }
}

export function estimateCreateReelPayloadBytes(body: {
  title: string;
  artist: string;
  genre: string;
  mediaType: string;
  mediaUrl: string;
  posterUrl?: string;
  durationSec?: number;
}): number {
  return new Blob([JSON.stringify(body)], { type: 'application/json' }).size;
}

export function payloadTooLargeForMsdev(payloadBytes: number): boolean {
  return payloadBytes > REEL_UPLOAD_JSON_LIMIT_BYTES - REEL_UPLOAD_PAYLOAD_MARGIN_BYTES;
}

export function formatPayloadSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${bytes} o`;
}

const IMPORT_VIDEO_TYPES = /^video\/(webm|mp4|quicktime|x-m4v)/i;

/** Importe une vidéo depuis la galerie (fichier local) pour reel privé. */
export function importVideoFile(file: File): Promise<{
  mediaUrl: string;
  posterUrl: string;
  durationSec: number;
}> {
  if (!IMPORT_VIDEO_TYPES.test(file.type)) {
    return Promise.reject(new Error('Format vidéo non pris en charge (WebM, MP4).'));
  }
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.playsInline = true;
    video.muted = true;

    const cleanup = () => {
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(objectUrl);
    };

    video.onloadedmetadata = () => {
      const durationSec = Math.max(
        1,
        Math.min(REEL_RECORD_MAX_SEC, Math.round(Number.isFinite(video.duration) ? video.duration : 0))
      );
      video.currentTime = Math.min(0.5, durationSec > 1 ? 0.5 : 0);
    };

    video.onseeked = () => {
      const posterUrl =
        captureVideoPosterDataUrl(video) ??
        'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA//2Q==';
      const durationSec = Math.max(
        1,
        Math.min(REEL_RECORD_MAX_SEC, Math.round(Number.isFinite(video.duration) ? video.duration : 0))
      );
      blobToDataUrl(file)
        .then((mediaUrl) => {
          cleanup();
          resolve({ mediaUrl, posterUrl, durationSec });
        })
        .catch((err) => {
          cleanup();
          reject(err instanceof Error ? err : new Error('Impossible de lire la vidéo'));
        });
    };

    video.onerror = () => {
      cleanup();
      reject(new Error('Impossible de lire cette vidéo'));
    };

    video.src = objectUrl;
  });
}
