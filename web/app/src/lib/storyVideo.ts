import { INSTAGRAM_STORY_LIMITS } from './imageConstraints';
import { FEED_VIDEO_LIMITS, getVideoDurationSec } from './feedVideo';

/** Durée max story vidéo (aligné Instagram). */
export const STORY_VIDEO_MAX_SEC = INSTAGRAM_STORY_LIMITS.video.maxDurationSeconds;

/** Taille max data URL (marge sous express.json 15 Mo). */
export const STORY_VIDEO_MAX_DATA_CHARS = FEED_VIDEO_LIMITS.maxDataUrlChars;

export const STORY_VIDEO_ACCEPTED_MIME = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
] as const;

export const ACCEPTED_STORY_VIDEO_FORMATS = STORY_VIDEO_ACCEPTED_MIME.join(',');

const ACCEPTED = new Set<string>(STORY_VIDEO_ACCEPTED_MIME);

/** Valide format, taille et durée d'une vidéo story (max 15 s). */
export async function validateStoryVideoFile(
  file: File
): Promise<{ valid: true; durationSec: number } | { valid: false; error: string }> {
  if (!ACCEPTED.has(file.type)) {
    return { valid: false, error: 'Format non supporté (MP4, WebM ou MOV)' };
  }
  const maxBytes = Math.min(
    INSTAGRAM_STORY_LIMITS.video.maxFileSizeBytes,
    FEED_VIDEO_LIMITS.maxFileSizeBytes
  );
  if (file.size > maxBytes) {
    const maxMb = Math.round(maxBytes / (1024 * 1024));
    return { valid: false, error: `Vidéo trop volumineuse (max ${maxMb} Mo)` };
  }
  try {
    const durationSec = await getVideoDurationSec(file);
    if (durationSec > STORY_VIDEO_MAX_SEC) {
      return {
        valid: false,
        error: `Vidéo trop longue (max ${STORY_VIDEO_MAX_SEC} s)`,
      };
    }
    return { valid: true, durationSec };
  } catch (e) {
    return {
      valid: false,
      error: e instanceof Error ? e.message : 'Impossible de lire cette vidéo',
    };
  }
}

export function fileToStoryVideoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Lecture vidéo impossible'));
        return;
      }
      if (result.length > STORY_VIDEO_MAX_DATA_CHARS) {
        reject(
          new Error('Vidéo trop volumineuse après encodage. Essayez une vidéo plus courte.')
        );
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(new Error('Lecture vidéo impossible'));
    reader.readAsDataURL(file);
  });
}

export function storyViewDurationMs(story: {
  videoUrl?: string;
  videoDurationSec?: number;
}): number {
  if (story.videoUrl?.trim()) {
    const sec = story.videoDurationSec;
    if (sec != null && Number.isFinite(sec) && sec > 0) {
      return Math.min(Math.max(Math.round(sec * 1000), 2000), STORY_VIDEO_MAX_SEC * 1000);
    }
    return STORY_VIDEO_MAX_SEC * 1000;
  }
  return 5000;
}
