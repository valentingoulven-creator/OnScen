import { ACCEPTED_FEED_VIDEO_FORMATS, FEED_VIDEO_LIMITS } from './imageConstraints';

export { ACCEPTED_FEED_VIDEO_FORMATS, FEED_VIDEO_LIMITS };

const ACCEPTED_VIDEO_TYPES = new Set<string>(FEED_VIDEO_LIMITS.acceptedFormats);

/** Durée d'une vidéo locale (secondes), via métadonnées navigateur. */
export function getVideoDurationSec(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      const d = video.duration;
      if (!Number.isFinite(d) || d <= 0) {
        reject(new Error('Durée vidéo illisible'));
        return;
      }
      resolve(d);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Impossible de lire cette vidéo'));
    };
    video.src = url;
  });
}

/** Valide format, taille et durée d'un fichier vidéo avant publication. */
export async function validateFeedVideoFile(
  file: File
): Promise<{ valid: true } | { valid: false; error: string }> {
  if (!ACCEPTED_VIDEO_TYPES.has(file.type)) {
    return { valid: false, error: 'Format non supporté (MP4, WebM ou MOV uniquement)' };
  }
  if (file.size > FEED_VIDEO_LIMITS.maxFileSizeBytes) {
    const maxMb = FEED_VIDEO_LIMITS.maxFileSizeBytes / (1024 * 1024);
    return { valid: false, error: `Vidéo trop volumineuse (max ${maxMb} Mo)` };
  }
  try {
    const duration = await getVideoDurationSec(file);
    if (duration > FEED_VIDEO_LIMITS.maxDurationSeconds) {
      return {
        valid: false,
        error: `Vidéo trop longue (max ${FEED_VIDEO_LIMITS.maxDurationSeconds} s)`,
      };
    }
  } catch (e) {
    return {
      valid: false,
      error: e instanceof Error ? e.message : 'Impossible de lire cette vidéo',
    };
  }
  return { valid: true };
}

/** Encode un fichier vidéo en data URL pour POST /api/feed (msdev). */
export function fileToFeedVideoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Lecture vidéo impossible'));
        return;
      }
      if (result.length > FEED_VIDEO_LIMITS.maxDataUrlChars) {
        reject(new Error('Vidéo trop volumineuse après encodage. Essayez une vidéo plus courte ou légère.'));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(new Error('Lecture vidéo impossible'));
    reader.readAsDataURL(file);
  });
}
