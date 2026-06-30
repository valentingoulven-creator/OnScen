import { isAcceptedImageFormat } from './imageConstraints';
import {
  MAP_BANNER_CROP_VIEWPORT_H,
  MAP_BANNER_CROP_VIEWPORT_W,
  MAP_BANNER_EXPORT_H,
  MAP_BANNER_EXPORT_W,
} from './sponsorDisplaySpec';
import { initialCoverScaleWH } from './profileImageProcessing';
import { computeStoryCropRect } from './storyImageCompose';
import { prepareImageFile } from './imageUtils';
import type { CropRect } from './profileImageProcessing';

export const SPONSOR_BANNER_MAX_FILE_BYTES = 3 * 1024 * 1024;
/** Export JPEG 1280×192 (2× retina de 640×96, ratio 20:3, aligné sur la coque carte). */
export const SPONSOR_BANNER_OUTPUT_W = MAP_BANNER_EXPORT_W;
export const SPONSOR_BANNER_OUTPUT_H = MAP_BANNER_EXPORT_H;
export const SPONSOR_BANNER_CROP_VIEWPORT_W = MAP_BANNER_CROP_VIEWPORT_W;
export const SPONSOR_BANNER_CROP_VIEWPORT_H = MAP_BANNER_CROP_VIEWPORT_H;
export const SPONSOR_BANNER_JPEG_QUALITY = 0.88;

const UPLOADS_SPONSOR_BANNER_RE = /^\/uploads\/sponsors\/banners\//i;

export const SPONSOR_BANNER_ACCEPT_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export const SPONSOR_BANNER_ACCEPT = [
  ...SPONSOR_BANNER_ACCEPT_MIME,
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
].join(',');

export function validateSponsorBannerFile(file: File): string | null {
  if (file.size > SPONSOR_BANNER_MAX_FILE_BYTES) {
    return 'Le bandeau ne doit pas dépasser 3 Mo.';
  }
  if (!isAcceptedImageFormat(file, SPONSOR_BANNER_ACCEPT_MIME)) {
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

export async function loadSponsorBannerBitmap(file: File): Promise<ImageBitmap> {
  const validationError = validateSponsorBannerFile(file);
  if (validationError) throw new Error(validationError);
  const prepared = await prepareImageFile(file);
  return decodeToBitmap(prepared);
}

export function computeSponsorBannerCropRect(
  imgW: number,
  imgH: number,
  scale: number,
  offsetX: number,
  offsetY: number
): CropRect {
  return computeStoryCropRect(
    imgW,
    imgH,
    SPONSOR_BANNER_CROP_VIEWPORT_W,
    SPONSOR_BANNER_CROP_VIEWPORT_H,
    scale,
    offsetX,
    offsetY
  );
}

export function initialSponsorBannerCoverScale(imgW: number, imgH: number): number {
  return initialCoverScaleWH(
    imgW,
    imgH,
    SPONSOR_BANNER_CROP_VIEWPORT_W,
    SPONSOR_BANNER_CROP_VIEWPORT_H
  );
}

/** Exporte la zone rognée en 1280×192 px (JPEG, ratio 20:3). */
export function exportSponsorBannerDataUrl(bitmap: ImageBitmap, crop: CropRect): string {
  const canvas = document.createElement('canvas');
  canvas.width = SPONSOR_BANNER_OUTPUT_W;
  canvas.height = SPONSOR_BANNER_OUTPUT_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas non disponible');
  ctx.drawImage(
    bitmap,
    crop.sx,
    crop.sy,
    crop.sw,
    crop.sh,
    0,
    0,
    SPONSOR_BANNER_OUTPUT_W,
    SPONSOR_BANNER_OUTPUT_H
  );
  return canvas.toDataURL('image/jpeg', SPONSOR_BANNER_JPEG_QUALITY);
}

/**
 * Résout une URL d'image de bandeau pour l'affichage (aperçu admin, carte).
 * Les chemins `/uploads/sponsors/banners/*` sont servis par le backend — en dev Vite les proxie.
 */
export function resolveSponsorBannerSrc(raw: string): string {
  const url = raw.trim();
  if (!url) return '';
  if (url.startsWith('data:') || /^https?:\/\//i.test(url)) return url;
  if (UPLOADS_SPONSOR_BANNER_RE.test(url)) return url;
  return url;
}
