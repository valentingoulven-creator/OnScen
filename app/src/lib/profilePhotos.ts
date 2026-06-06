import { PROFILE_PHOTO_JPEG_QUALITY, PROFILE_PHOTO_MAX_DIMENSION } from './profileImageProcessing';

const MAX_IMAGE_DIMENSION = PROFILE_PHOTO_MAX_DIMENSION;
const JPEG_QUALITY = PROFILE_PHOTO_JPEG_QUALITY;
/** Marge sous la limite express.json (2 Mo) pour le corps JSON complet. */
export const MAX_PROFILE_PAYLOAD_CHARS = 1_900_000;

export async function compressProfilePhotoDataUrl(dataUrl: string): Promise<string> {
  const trimmed = dataUrl.trim();
  if (!trimmed.startsWith('data:image/')) return trimmed;

  try {
    const res = await fetch(trimmed);
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return trimmed;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  } catch {
    return trimmed;
  }
}

export async function prepareProfilePhotosForSave(photos: string[]): Promise<string[]> {
  const prepared: string[] = [];
  for (const photo of photos) {
    const url = photo.trim();
    if (!url) continue;
    if (url.startsWith('data:image/')) {
      prepared.push(await compressProfilePhotoDataUrl(url));
    } else {
      prepared.push(url);
    }
  }
  return prepared.slice(0, 6);
}

export function profilePhotosChanged(current: string[], next: string[]): boolean {
  if (current.length !== next.length) return true;
  return next.some((p, i) => p !== current[i]);
}
