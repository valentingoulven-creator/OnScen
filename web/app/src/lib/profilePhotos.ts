import { isDicebearAvatarUrl } from './avatarUrl';
import { PROFILE_PHOTO_JPEG_QUALITY, PROFILE_PHOTO_MAX_DIMENSION } from './profileImageProcessing';

const MAX_IMAGE_DIMENSION = PROFILE_PHOTO_MAX_DIMENSION;
const JPEG_QUALITY = PROFILE_PHOTO_JPEG_QUALITY;
const MAX_PROFILE_PHOTOS = 5;

/** Session-only preview URLs — never persist or treat as saved photos. */
export function isEphemeralProfilePhotoUrl(url: string): boolean {
  return url.trim().startsWith('blob:');
}

/** URLs safe to render in <img> (excludes expired blob: and DiceBear). */
export function isDisplayableProfilePhotoUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed || isDicebearAvatarUrl(trimmed) || isEphemeralProfilePhotoUrl(trimmed)) {
    return false;
  }
  return (
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://')
  );
}

export function isPersistableProfilePhotoUrl(url: string): boolean {
  const trimmed = url.trim();
  return Boolean(trimmed) && !isDicebearAvatarUrl(trimmed) && !isEphemeralProfilePhotoUrl(trimmed);
}

/** @deprecated internal alias */
function isRealProfilePhoto(url: string): boolean {
  return isPersistableProfilePhotoUrl(url);
}

/** Unsaved local edits (blob:/data:) or any real photo slot in the form. */
export function formHasProfilePhotoEdits(photos: string[]): boolean {
  return photos.some((url) => {
    const trimmed = url.trim();
    if (!trimmed) return false;
    return (
      isEphemeralProfilePhotoUrl(trimmed) ||
      trimmed.startsWith('data:image/') ||
      isPersistableProfilePhotoUrl(trimmed)
    );
  });
}

export function countPersistableProfilePhotos(photos: string[]): number {
  return normalizeProfilePhotoSlots(photos).filter(isPersistableProfilePhotoUrl).length;
}

/** Throws when compression/conversion dropped photos the user intended to save. */
export function assertPreparedProfilePhotos(intent: string[], prepared: string[]): void {
  const intended = countPersistableProfilePhotos(intent);
  const saved = countPersistableProfilePhotos(prepared);
  if (intended > 0 && saved === 0) {
    throw new Error(
      'Impossible d\'enregistrer les photos du profil. Réessayez ou choisissez une autre image.'
    );
  }
  if (intended > saved) {
    throw new Error(
      'Certaines photos n\'ont pas pu être enregistrées. Réessayez ou utilisez des images plus légères.'
    );
  }
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

/** Load an image from any URL (data:, blob:, https:) without using fetch(). */
function loadBitmapFromUrl(url: string): Promise<ImageBitmap> {
  return new Promise<ImageBitmap>((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      createImageBitmap(img).then(resolve, () => reject(new Error('decode')));
    img.onerror = () => reject(new Error('load'));
    img.src = url;
  });
}

export async function compressProfilePhotoDataUrl(dataUrl: string): Promise<string> {
  const trimmed = dataUrl.trim();
  if (!trimmed.startsWith('data:image/')) return trimmed;

  try {
    const bitmap = await loadBitmapFromUrl(trimmed);
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

async function blobUrlToProfileDataUrl(blobUrl: string): Promise<string> {
  try {
    const bitmap = await loadBitmapFromUrl(blobUrl);
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return '';
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  } catch {
    return '';
  }
}

/** Convert blob/data preview URLs to persistable base64 JPEG; keep remote https URLs. */
export async function ensurePersistableProfilePhotoUrl(url: string): Promise<string> {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('data:image/')) {
    return compressProfilePhotoDataUrl(trimmed);
  }
  if (trimmed.startsWith('blob:')) {
    return blobUrlToProfileDataUrl(trimmed);
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return '';
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
    prepared.push(await ensurePersistableProfilePhotoUrl(url));
  }
  return prepared;
}

export function profilePhotosChanged(current: string[], next: string[]): boolean {
  if (formHasProfilePhotoEdits(next)) {
    for (let i = 0; i < next.length; i++) {
      const raw = next[i]?.trim() ?? '';
      if (!raw || isEphemeralProfilePhotoUrl(raw) || raw.startsWith('data:image/')) {
        const a = normalizeProfilePhotoSlots(current);
        const persisted = a[i]?.trim() ?? '';
        if (raw !== persisted) return true;
      }
    }
  }
  const a = normalizeProfilePhotoSlots(current);
  const b = normalizeProfilePhotoSlots(next);
  if (a.length !== b.length) return true;
  return b.some((p, i) => p !== a[i]);
}

/** Whether PATCH /auth/profile must include profilePhotos for this form state. */
export function shouldIncludeProfilePhotosInSave(
  current: string[],
  next: string[]
): boolean {
  return (
    profilePhotosChanged(current, next) ||
    formHasProfilePhotoEdits(next) ||
    countPersistableProfilePhotos(current) > 0
  );
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
