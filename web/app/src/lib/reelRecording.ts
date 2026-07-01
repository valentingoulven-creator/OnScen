/**
 * Durée max d'enregistrement / import (short-form). 60 s — cohérent avec la capacité de
 * modération vidéo synchrone Sightengine (60 s) tout en restant bien sous les standards
 * marché (TikTok : 10 min enregistrement / 60 min import ; Instagram Reels : 90 s à 3 min
 * recommandés). Doit rester synchronisé avec REEL_RECORD_MAX_SEC côté backend
 * (reelUploadLimits.ts).
 */
export const REEL_RECORD_MAX_SEC = 60;

/** TikTok mobile upload cap — 287 MiB (commonly cited for short-form video). */
export const REEL_UPLOAD_MAX_FILE_BYTES = 287 * 1024 * 1024;

/** Taille max estimée du corps POST (base64 ~4/3 + poster/métadonnées). */
export const REEL_UPLOAD_JSON_LIMIT_BYTES =
  Math.ceil(REEL_UPLOAD_MAX_FILE_BYTES * (4 / 3)) + 512 * 1024;

/** Marge pour métadonnées JSON hors data URL vidéo. */
export const REEL_UPLOAD_PAYLOAD_MARGIN_BYTES = 512 * 1024;

/** Max longueur data URL vidéo (base64 + préfixe). */
export const MAX_RECORDED_REEL_VIDEO_DATA_CHARS =
  Math.ceil((REEL_UPLOAD_MAX_FILE_BYTES * 4) / 3) + 64;

/**
 * Bitrate d'enregistrement (720×1280 cible). 250 kbps vidéo / 32 kbps audio produisait un
 * rendu très dégradé (proche d'un appel vidéo basse qualité) comparé aux standards courts-
 * métrages TikTok/Instagram (H.264 recommandé 8-16 Mbps, Instagram 3,5-10 Mbps). 3 Mbps /
 * 128 kbps reste très en dessous de ces cibles mais donne un rendu net en 720p vertical, tout
 * en laissant une marge confortable sous le plafond de taille (287 Mio pour 60 s max = <10 %
 * du budget utilisé à ce bitrate).
 */
export const REEL_RECORD_VIDEO_BITS_PER_SEC = 3_000_000;
export const REEL_RECORD_AUDIO_BITS_PER_SEC = 128_000;

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

export function validateReelVideoFile(file: File): string | null {
  if (!IMPORT_VIDEO_TYPES.test(file.type)) {
    return 'Format vidéo non pris en charge (MP4, WebM, MOV).';
  }
  if (file.size > REEL_UPLOAD_MAX_FILE_BYTES) {
    return `Fichier trop lourd (max ${formatPayloadSize(REEL_UPLOAD_MAX_FILE_BYTES)}). Réduisez la durée ou la qualité.`;
  }
  return null;
}

/** Importe une vidéo depuis la galerie (fichier local) pour reel privé. */
export function importVideoFile(file: File): Promise<{
  mediaUrl: string;
  posterUrl: string;
  durationSec: number;
}> {
  const validationError = validateReelVideoFile(file);
  if (validationError) {
    return Promise.reject(new Error(validationError));
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
      const rawDuration = Number.isFinite(video.duration) ? video.duration : 0;
      if (rawDuration > REEL_RECORD_MAX_SEC) {
        cleanup();
        reject(
          new Error(`Vidéo trop longue (max ${REEL_RECORD_MAX_SEC} s). Découpez ou choisissez un clip plus court.`)
        );
        return;
      }
      const durationSec = Math.max(1, Math.round(rawDuration));
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
