import { isDicebearAvatarUrl } from './avatarUrl';
import { PROFILE_PHOTO_JPEG_QUALITY, PROFILE_PHOTO_MAX_DIMENSION } from './profileImageProcessing';

const MAX_IMAGE_DIMENSION = PROFILE_PHOTO_MAX_DIMENSION;
const JPEG_QUALITY = PROFILE_PHOTO_JPEG_QUALITY;
const MAX_PROFILE_PHOTOS = 5;

function isRealProfilePhoto(url: string): boolean {
  const trimmed = url.trim();
  return Boolean(trimmed) && !isDicebearAvatarUrl(trimmed);
}

/** Preserve [avatar, g1…g4] slots; index 0 may be '' when only gallery photos exist. */
export function normalizeProfilePhotoSlots(photos: string[]): string[] {
  const slots = photos.map((u) => u.trim()).slice(0, MAX_PROFILE_PHOTOS);
  let lastIdx = -1;
  for (let i = slots.length - 1; i >= 0; i--) {
    if (isRealProfilePhoto(slots[i] ?? '')) {
      lastIdx = i;
      break;
    }
  }
  if (lastIdx < 0) return [];

  const out: string[] = [];
  for (let i = 0; i <= lastIdx; i++) {
    const url = slots[i] ?? '';
    if (isRealProfilePhoto(url)) {
      out.push(url);
    } else if (i === 0 && slots.slice(1).some(isRealProfilePhoto)) {
      out.push('');
    }
  }
  return out;
}
/** Marge sous la limite express.json (15 Mo) pour le corps JSON complet (12 Mo). */
export const MAX_PROFILE_PAYLOAD_CHARS = 12_000_000;

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
  const slots = normalizeProfilePhotoSlots(photos);
  const prepared: string[] = [];
  for (const photo of slots) {
    const url = photo.trim();
    if (!url) {
      prepared.push('');
      continue;
    }
    if (url.startsWith('data:image/')) {
      prepared.push(await compressProfilePhotoDataUrl(url));
    } else {
      prepared.push(url);
    }
  }
  return prepared;
}

export function profilePhotosChanged(current: string[], next: string[]): boolean {
  const a = normalizeProfilePhotoSlots(current);
  const b = normalizeProfilePhotoSlots(next);
  if (a.length !== b.length) return true;
  return b.some((p, i) => p !== a[i]);
}

/** Real uploaded profile photos — excludes DiceBear placeholders. */
export function getUserProfilePhotos(
  user: { profilePhotos?: string[]; avatarUrl?: string } | null | undefined
): string[] {
  const raw = user?.profilePhotos ?? [];
  if (raw.length > 0) {
    const normalized = normalizeProfilePhotoSlots(raw.map(String));
    if (normalized.length > 0) return normalized;
  }
  const avatar = user?.avatarUrl?.trim();
  if (avatar && !isDicebearAvatarUrl(avatar)) return [avatar];
  return [];
}

/** First real profile photo for display — ignores DiceBear avatarUrl and empty avatar slots. */
export function resolveAvatarUrl(
  user: { profilePhotos?: string[]; avatarUrl?: string } | null | undefined
): string | undefined {
  const firstPhoto = getUserProfilePhotos(user).find((url) => url.trim());
  if (firstPhoto) return firstPhoto;
  const avatar = user?.avatarUrl?.trim();
  if (avatar && !isDicebearAvatarUrl(avatar)) return avatar;
  return undefined;
}
