import { INSTAGRAM_IMAGE_LIMITS, validateImageFile } from './imageConstraints';

/** Dimension de sortie cible pour les photos de profil (Instagram : 400 × 400 px) */
export const PROFILE_PHOTO_MAX_DIMENSION = 400;
/** Qualité JPEG de sortie conforme aux specs Instagram (0.85) */
export const PROFILE_PHOTO_JPEG_QUALITY = 0.85;

export async function loadImageBitmapFromFile(file: File): Promise<ImageBitmap> {
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('Impossible de lire cette image');
  }
  if (bitmap.width < INSTAGRAM_IMAGE_LIMITS.minWidth) {
    bitmap.close();
    throw new Error('Image trop petite (minimum 320 px de large)');
  }
  return bitmap;
}

export interface CropRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/** Zone source dans l'image d'origine pour la fenêtre carrée de rognage. */
export function computeCropRectFromViewport(
  imgW: number,
  imgH: number,
  viewportSize: number,
  scale: number,
  offsetX: number,
  offsetY: number
): CropRect {
  const scaledW = imgW * scale;
  const scaledH = imgH * scale;
  const left = (viewportSize - scaledW) / 2 + offsetX;
  const top = (viewportSize - scaledH) / 2 + offsetY;

  const sx = Math.max(0, (0 - left) / scale);
  const sy = Math.max(0, (0 - top) / scale);
  const sw = Math.min(imgW - sx, viewportSize / scale);
  const sh = Math.min(imgH - sy, viewportSize / scale);

  return {
    sx: Math.round(sx),
    sy: Math.round(sy),
    sw: Math.max(1, Math.round(sw)),
    sh: Math.max(1, Math.round(sh)),
  };
}

export function initialCoverScale(imgW: number, imgH: number, viewportSize: number): number {
  return Math.max(viewportSize / imgW, viewportSize / imgH);
}

/** Scale initiale cover pour un viewport rectangulaire (W × H). */
export function initialCoverScaleWH(
  imgW: number,
  imgH: number,
  viewW: number,
  viewH: number
): number {
  return Math.max(viewW / imgW, viewH / imgH);
}

/** Export carré : photo de profil (1:1), max 1080 px, JPEG 0.85. */
export function bitmapCropToProfileDataUrl(
  bitmap: ImageBitmap,
  crop: CropRect,
  maxDim = PROFILE_PHOTO_MAX_DIMENSION,
  quality = PROFILE_PHOTO_JPEG_QUALITY
): string {
  const side = Math.min(crop.sw, crop.sh);
  const outSize = Math.min(maxDim, side);
  const canvas = document.createElement('canvas');
  canvas.width = outSize;
  canvas.height = outSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Impossible de traiter l\'image');

  const sx = crop.sx + (crop.sw - side) / 2;
  const sy = crop.sy + (crop.sh - side) / 2;
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, outSize, outSize);
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Export avec ratio libre (1:1, 4:5, 1.91:1…).
 * La largeur est limitée à maxW (1080 px par défaut), hauteur proportionnelle.
 */
export function bitmapCropToAspectDataUrl(
  bitmap: ImageBitmap,
  crop: CropRect,
  maxW = PROFILE_PHOTO_MAX_DIMENSION,
  quality = PROFILE_PHOTO_JPEG_QUALITY
): string {
  const outW = Math.min(maxW, crop.sw);
  const outH = Math.round(outW * (crop.sh / Math.max(1, crop.sw)));
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Impossible de traiter l\'image');
  ctx.drawImage(bitmap, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, outW, outH);
  return canvas.toDataURL('image/jpeg', quality);
}
