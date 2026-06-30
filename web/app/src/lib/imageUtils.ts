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
  normalizeHeicFileMetadata,
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

const HEIC_CONVERSION_FAILED_ERROR =
  'Impossible de convertir cette photo HEIC/HEIF. Réessayez avec une autre photo ou exportez-la en JPEG depuis votre appareil.';

const BROWSER_READABLE_MIME: Record<BrowserReadableImageKind, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
};

type Heic2AnyFn = (options: {
  blob: Blob;
  toType?: string;
  quality?: number;
  multiple?: boolean;
}) => Promise<Blob | Blob[]>;

let heic2anyLoader: Promise<Heic2AnyFn> | null = null;

/** Import dynamique via chunk local (évite fusion vendor-misc + mauvais export). */
async function loadHeic2any(): Promise<Heic2AnyFn> {
  if (!heic2anyLoader) {
    heic2anyLoader = import('./heic2anyLoader').then((mod) => {
      const fn = mod.default;
      if (typeof fn !== 'function') {
        throw new Error('Module heic2any indisponible');
      }
      return fn as Heic2AnyFn;
    });
  }
  return heic2anyLoader;
}

function heicConversionBlobCandidates(file: File): Blob[] {
  const normalized = file;
  const candidates: Blob[] = [normalized];
  const types = ['image/heic', 'image/heif', 'application/octet-stream'] as const;
  for (const type of types) {
    if (normalized.type !== type) {
      candidates.push(new File([normalized], normalized.name, { type }));
    }
  }
  const altExt = normalized.name.toLowerCase().endsWith('.heif') ? '.heic' : '.heif';
  const altName = normalized.name.replace(/\.(heic|heif)$/i, '') + altExt;
  if (altName !== normalized.name) {
    candidates.push(new File([normalized], altName, { type: normalized.type || 'image/heic' }));
  }
  return candidates;
}

const HEIC_CONVERSION_QUALITIES = [0.92, 0.85, 0.7] as const;

type HeicConversionAttempt = {
  toType: 'image/jpeg' | 'image/png';
  multiple: boolean;
};

/** heic2any rejette avec { code, message }, pas une instance Error. */
function heic2anyErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err) {
    const message = (err as { message: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return String(err ?? '');
}

function browserReadableKindFromHeic2anyError(err: unknown): BrowserReadableImageKind | null {
  const msg = heic2anyErrorMessage(err);
  if (!msg.includes('already browser readable')) return null;
  if (msg.includes('image/png')) return 'png';
  if (msg.includes('image/gif')) return 'gif';
  return 'jpeg';
}

function fileFromConvertedBlob(file: File, blob: Blob): File {
  const baseName = file.name.replace(/\.(heic|heif)$/i, '') || 'photo';
  const isJpeg = blob.type === 'image/jpeg' || blob.type === 'image/jpg';
  const ext = isJpeg ? '.jpg' : blob.type === 'image/png' ? '.png' : '.jpg';
  const type = isJpeg ? 'image/jpeg' : blob.type || 'image/jpeg';
  return new File([blob], `${baseName}${ext}`, { type });
}

async function bitmapToJpegFile(
  bitmap: ImageBitmap,
  baseName: string,
  quality = 0.92
): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas non disponible');
  ctx.drawImage(bitmap, 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Conversion canvas échouée'))),
      'image/jpeg',
      quality
    );
  });
  const name = `${baseName.replace(/\.(heic|heif|jpe?g|png|gif)$/i, '') || 'photo'}.jpg`;
  return new File([blob], name, { type: 'image/jpeg' });
}

/** Safari et futurs navigateurs peuvent décoder HEIC sans heic2any. */
async function tryConvertViaNativeDecode(file: File): Promise<File | null> {
  const baseName = file.name.replace(/\.(heic|heif)$/i, '') || 'photo';
  try {
    const bitmap = await createImageBitmap(file);
    try {
      return await bitmapToJpegFile(bitmap, baseName);
    } finally {
      bitmap.close();
    }
  } catch {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        void createImageBitmap(img)
          .then(async (bitmap) => {
            try {
              resolve(await bitmapToJpegFile(bitmap, baseName));
            } catch {
              resolve(null);
            } finally {
              bitmap.close();
            }
          })
          .catch(() => resolve(null));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  }
}

async function blobToJpegFile(source: File, blob: Blob): Promise<File> {
  if (blob.type === 'image/jpeg' || blob.type === 'image/jpg') {
    return fileFromConvertedBlob(source, blob);
  }
  const bitmap = await createImageBitmap(blob);
  try {
    const baseName = source.name.replace(/\.(heic|heif)$/i, '') || 'photo';
    return await bitmapToJpegFile(bitmap, baseName);
  } finally {
    bitmap.close();
  }
}

function normalizeBrowserReadableFile(file: File, kind: BrowserReadableImageKind): File {
  const mime = BROWSER_READABLE_MIME[kind];
  if (file.type === mime) return file;
  const ext = kind === 'jpeg' ? '.jpg' : kind === 'png' ? '.png' : '.gif';
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo';
  return new File([file], `${baseName}${ext}`, { type: mime });
}

async function convertHeicToJpegFile(file: File, header: Uint8Array): Promise<File> {
  const native = await tryConvertViaNativeDecode(file);
  if (native) return native;

  const heic2any = await loadHeic2any();
  const normalized = normalizeHeicFileMetadata(file, header);
  let lastError: unknown;

  const attempts: HeicConversionAttempt[] = [
    { toType: 'image/jpeg', multiple: false },
    { toType: 'image/jpeg', multiple: true },
    { toType: 'image/png', multiple: false },
    { toType: 'image/png', multiple: true },
  ];

  for (const candidate of heicConversionBlobCandidates(normalized)) {
    for (const { toType, multiple } of attempts) {
      for (const quality of HEIC_CONVERSION_QUALITIES) {
        try {
          const result = await heic2any({
            blob: candidate,
            toType,
            quality,
            multiple,
          });
          const converted = Array.isArray(result) ? result[0] : result;
          if (!(converted instanceof Blob)) {
            throw new Error('Conversion HEIC échouée');
          }
          return await blobToJpegFile(normalized, converted);
        } catch (err) {
          const readableKind = browserReadableKindFromHeic2anyError(err);
          if (readableKind) {
            return normalizeBrowserReadableFile(normalized, readableKind);
          }
          lastError = err;
        }
      }
    }
  }

  throw new Error(heic2anyErrorMessage(lastError) || HEIC_CONVERSION_FAILED_ERROR);
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
    return await convertHeicToJpegFile(file, header);
  } catch {
    throw new Error(HEIC_CONVERSION_FAILED_ERROR);
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
