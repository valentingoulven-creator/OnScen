// ─── Unified Instagram image utility ─────────────────────────────────────────
// Single public API for all image upload points.
// New upload code should import from here; do not import imageConstraints directly.

import {
  INSTAGRAM_IMAGE_LIMITS,
  INSTAGRAM_POST_LIMITS,
  INSTAGRAM_STORY_LIMITS,
  INSTAGRAM_PROFILE_PHOTO_LIMITS,
  ACCEPTED_IMAGE_FORMATS,
  ACCEPTED_IMAGE_EXTENSIONS,
  ACCEPTED_IMAGE_MIME_TYPES,
  SUPPORTED_IMAGE_FORMATS_LABEL,
  isHeicImageFile,
  isHeicImageFileAsync,
  readImageFileHeader,
  sniffHeicMagicBytes,
  browserReadableKindFromHeader,
  validateImageFile as _validateImageFileDetailed,
  validateStoryPhoto,
  validateProfilePhoto,
  resizeToInstagramSpecs,
  resizeToStorySpecs,
  resizeToProfilePhotoSpecs,
  type BrowserReadableImageKind,
} from './imageConstraints';

export {
  INSTAGRAM_IMAGE_LIMITS,
  INSTAGRAM_POST_LIMITS,
  INSTAGRAM_STORY_LIMITS,
  INSTAGRAM_PROFILE_PHOTO_LIMITS,
  ACCEPTED_IMAGE_FORMATS,
  ACCEPTED_IMAGE_EXTENSIONS,
  ACCEPTED_IMAGE_MIME_TYPES,
  SUPPORTED_IMAGE_FORMATS_LABEL,
  isHeicImageFile,
  isHeicImageFileAsync,
  validateStoryPhoto,
  validateProfilePhoto,
  resizeToInstagramSpecs,
  resizeToStorySpecs,
  resizeToProfilePhotoSpecs,
};

const HEIC_UNSUPPORTED_ERROR =
  'Ce navigateur ne peut pas lire les photos HEIC/HEIF. Exportez la photo en JPEG depuis votre appareil.';

const BROWSER_READABLE_MIME: Record<BrowserReadableImageKind, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
};

type Heic2AnyFn = (options: {
  blob: Blob;
  toType?: string;
  quality?: number;
}) => Promise<Blob | Blob[]>;

let heic2anyLoader: Promise<Heic2AnyFn> | null = null;

/** Import dynamique pour Vite (chunk séparé, worker heic2any intact). */
async function loadHeic2any(): Promise<Heic2AnyFn> {
  if (!heic2anyLoader) {
    heic2anyLoader = import('heic2any').then((mod) => {
      const fn = mod.default ?? mod;
      if (typeof fn !== 'function') {
        throw new Error('Module heic2any indisponible');
      }
      return fn as Heic2AnyFn;
    });
  }
  return heic2anyLoader;
}

function heicConversionBlobCandidates(file: File): Blob[] {
  const candidates: Blob[] = [file];
  const types = ['image/heic', 'image/heif', 'application/octet-stream'] as const;
  for (const type of types) {
    if (file.type !== type) {
      candidates.push(file.slice(0, file.size, type));
    }
  }
  return candidates;
}

function isHeicAlreadyReadableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('already browser readable');
}

function fileFromConvertedBlob(file: File, blob: Blob): File {
  const baseName = file.name.replace(/\.(heic|heif)$/i, '') || 'photo';
  return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
}

function normalizeBrowserReadableFile(file: File, kind: BrowserReadableImageKind): File {
  const mime = BROWSER_READABLE_MIME[kind];
  if (file.type === mime) return file;
  const ext = kind === 'jpeg' ? '.jpg' : kind === 'png' ? '.png' : '.gif';
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo';
  return new File([file], `${baseName}${ext}`, { type: mime });
}

async function convertHeicToJpegFile(file: File): Promise<File> {
  const heic2any = await loadHeic2any();
  let lastError: unknown;

  for (const candidate of heicConversionBlobCandidates(file)) {
    try {
      const result = await heic2any({
        blob: candidate,
        toType: 'image/jpeg',
        quality: 0.92,
      });
      const converted = Array.isArray(result) ? result[0] : result;
      if (!(converted instanceof Blob)) {
        throw new Error('Conversion HEIC échouée');
      }
      return fileFromConvertedBlob(file, converted);
    } catch (err) {
      if (isHeicAlreadyReadableError(err)) {
        return normalizeBrowserReadableFile(file, 'jpeg');
      }
      lastError = err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(HEIC_UNSUPPORTED_ERROR);
}

/**
 * Convertit HEIC/HEIF en JPEG si nécessaire ; retourne le fichier tel quel sinon.
 * Pipeline unifié (profil, story, fil) : heic2any avant createImageBitmap.
 */
export async function prepareImageFile(file: File): Promise<File> {
  const header = await readImageFileHeader(file);
  const browserKind = browserReadableKindFromHeader(header);
  if (browserKind) {
    return normalizeBrowserReadableFile(file, browserKind);
  }

  const needsHeic = sniffHeicMagicBytes(header) || isHeicImageFile(file);
  if (!needsHeic) return file;

  try {
    return await convertHeicToJpegFile(file);
  } catch {
    throw new Error(HEIC_UNSUPPORTED_ERROR);
  }
}

/** Drop-in config object (MODIF 284 / 293). */
export const INSTAGRAM_CONFIG = {
  maxSizeMB: INSTAGRAM_IMAGE_LIMITS.maxInputFileSizeMB,
  maxPx: INSTAGRAM_IMAGE_LIMITS.maxWidth,
  minPx: INSTAGRAM_IMAGE_LIMITS.minWidth,
  accept: INSTAGRAM_IMAGE_LIMITS.acceptedFormats.join(','),
} as const;

/**
 * Validates a file against Instagram image rules.
 * Returns a French error string, or null if the file is acceptable.
 */
export function validateImageFile(file: File): string | null {
  const result = _validateImageFileDetailed(file);
  return result.valid ? null : (result.error ?? 'Fichier non valide');
}

/**
 * Resizes an image to Instagram specs via canvas.
 * Optionally crops to a target aspect ratio before resizing.
 * Returns a JPEG base64 data URL.
 */
export async function resizeImageInstagram(
  file: File,
  targetAspect?: '1:1' | '4:5' | '9:16' | '1.91:1'
): Promise<string> {
  const { maxWidth, minWidth, outputQuality, outputFormat } = INSTAGRAM_IMAGE_LIMITS;
  const prepared = await prepareImageFile(file);

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(prepared);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let sw = img.width;
      let sh = img.height;
      let sx = 0;
      let sy = 0;

      if (targetAspect) {
        const [wRatio, hRatio] =
          targetAspect === '1.91:1' ? [191, 100] : targetAspect.split(':').map(Number);
        const targetRatioW = wRatio / hRatio;
        const srcRatio = sw / sh;

        if (srcRatio > targetRatioW) {
          sw = Math.round(sh * targetRatioW);
          sx = Math.round((img.width - sw) / 2);
        } else if (srcRatio < targetRatioW) {
          sh = Math.round(sw / targetRatioW);
          sy = Math.round((img.height - sh) / 2);
        }
      }

      if (sw < minWidth || sh < minWidth) {
        reject(new Error(`Image trop petite (minimum ${minWidth} px)`));
        return;
      }

      const scale = Math.min(1, maxWidth / Math.max(sw, sh));
      const dw = Math.max(1, Math.round(sw * scale));
      const dh = Math.max(1, Math.round(sh * scale));

      const canvas = document.createElement('canvas');
      canvas.width = dw;
      canvas.height = dh;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas non disponible'));
        return;
      }

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
      resolve(canvas.toDataURL(outputFormat, outputQuality));
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Impossible de charger cette image'));
    };

    img.src = objectUrl;
  });
}
