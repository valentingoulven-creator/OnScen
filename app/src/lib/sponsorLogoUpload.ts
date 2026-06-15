import { getImageFileMimeType, isAcceptedImageFormat } from './imageConstraints';
import {
  bitmapCropToProfileDataUrl,
  type CropRect,
} from './profileImageProcessing';
import { prepareImageFile } from './imageUtils';

export const SPONSOR_LOGO_MAX_FILE_BYTES = 2 * 1024 * 1024;
export const SPONSOR_LOGO_OUTPUT_PX = 80;
export const SPONSOR_LOGO_CROP_VIEWPORT_PX = 240;
export const SPONSOR_LOGO_JPEG_QUALITY = 0.88;

const UPLOADS_SPONSOR_LOGO_RE = /^\/uploads\/sponsors\//i;

export const SPONSOR_LOGO_ACCEPT_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

/** Attribut `accept` pour le sélecteur de logo sponsor. */
export const SPONSOR_LOGO_ACCEPT = [
  ...SPONSOR_LOGO_ACCEPT_MIME,
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
].join(',');

export function validateSponsorLogoFile(file: File): string | null {
  if (file.size > SPONSOR_LOGO_MAX_FILE_BYTES) {
    return 'Le logo ne doit pas dépasser 2 Mo.';
  }
  if (!isAcceptedImageFormat(file, SPONSOR_LOGO_ACCEPT_MIME)) {
    return 'Format non supporté. Utilisez JPEG, PNG, WebP ou GIF.';
  }
  return null;
}

async function decodeToBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file);
  } catch {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        void createImageBitmap(img)
          .then(resolve)
          .catch(() => reject(new Error('Impossible de lire cette image.')));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Impossible de lire cette image.'));
      };
      img.src = url;
    });
  }
}

/** Charge une image pour le rognage sponsor (sans contrainte Instagram 320 px). */
export async function loadSponsorLogoBitmap(file: File): Promise<ImageBitmap> {
  const validationError = validateSponsorLogoFile(file);
  if (validationError) throw new Error(validationError);
  const prepared = await prepareImageFile(file);
  return decodeToBitmap(prepared);
}

/** Exporte la zone rognée en carré 80×80 px (JPEG). */
export function exportSponsorLogoDataUrl(bitmap: ImageBitmap, crop: CropRect): string {
  return bitmapCropToProfileDataUrl(
    bitmap,
    crop,
    SPONSOR_LOGO_OUTPUT_PX,
    SPONSOR_LOGO_JPEG_QUALITY
  );
}

/**
 * Résout une URL de logo sponsor pour l'affichage (aperçu formulaire, listes admin).
 * Les chemins `/uploads/sponsors/*` sont servis par le backend — en dev Vite les proxie.
 */
export function resolveSponsorLogoSrc(raw: string): string {
  const url = raw.trim();
  if (!url) return '';
  if (url.startsWith('data:') || /^https?:\/\//i.test(url)) return url;
  if (UPLOADS_SPONSOR_LOGO_RE.test(url)) return url;
  return url;
}

/** Rogne au centre et redimensionne en carré 80×80 px, retourne une data URL JPEG. */
export async function prepareSponsorLogoDataUrl(file: File): Promise<string> {
  const validationError = validateSponsorLogoFile(file);
  if (validationError) throw new Error(validationError);

  const prepared = await prepareImageFile(file);
  const bitmap = await decodeToBitmap(prepared);

  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const sx = Math.floor((bitmap.width - side) / 2);
    const sy = Math.floor((bitmap.height - side) / 2);
    const out = SPONSOR_LOGO_OUTPUT_PX;

    const canvas = document.createElement('canvas');
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas non disponible');

    if (getImageFileMimeType(prepared) === 'image/gif') {
      ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, out, out);
      return canvas.toDataURL('image/png');
    }

    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, out, out);
    return canvas.toDataURL('image/jpeg', SPONSOR_LOGO_JPEG_QUALITY);
  } finally {
    bitmap.close();
  }
}
