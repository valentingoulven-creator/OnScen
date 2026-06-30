import { loadImageBitmapFromDataUrl } from './storyImageCompose';
import { loadImageBitmapFromFile } from './profileImageProcessing';
import { INSTAGRAM_IMAGE_LIMITS } from './imageConstraints';

const FEED_IMAGE_MAX_DIMENSION = 1080;
const FEED_IMAGE_JPEG_QUALITY = 0.85;
/** Aligné sur backend MAX_FEED_IMAGE_DATA_CHARS (~900 Ko JPEG 1080 px). */
export const FEED_IMAGE_MAX_DATA_CHARS = 1_200_000;

const ACCEPTED_FORMATS = new Set<string>(INSTAGRAM_IMAGE_LIMITS.acceptedFormats);

export function clipboardItemsToImageFile(items: DataTransferItemList): File | null {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!ACCEPTED_FORMATS.has(item.type)) continue;
    const file = item.getAsFile();
    if (file) return file;
  }
  return null;
}

export async function clipboardItemsToFeedImageDataUrl(
  items: DataTransferItemList
): Promise<string | null> {
  const file = clipboardItemsToImageFile(items);
  if (!file) return null;
  return fileToFeedImageDataUrl(file);
}

export async function dataUrlToFeedImageDataUrl(dataUrl: string): Promise<string> {
  const bitmap = await loadImageBitmapFromDataUrl(dataUrl);
  try {
    return bitmapToFeedImageDataUrl(bitmap);
  } finally {
    bitmap.close();
  }
}

export async function fileToFeedImageDataUrl(file: File): Promise<string> {
  const bitmap = await loadImageBitmapFromFile(file);
  try {
    return bitmapToFeedImageDataUrl(bitmap);
  } finally {
    bitmap.close();
  }
}

function bitmapToFeedImageDataUrl(bitmap: ImageBitmap): string {
  let maxSide = Math.max(bitmap.width, bitmap.height, 1);
  let quality = FEED_IMAGE_JPEG_QUALITY;

  while (maxSide >= INSTAGRAM_IMAGE_LIMITS.minWidth) {
    const scale = Math.min(1, FEED_IMAGE_MAX_DIMENSION / maxSide);
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Impossible de traiter l'image");

    ctx.drawImage(bitmap, 0, 0, w, h);

    let q = quality;
    let dataUrl = canvas.toDataURL('image/jpeg', q);
    while (dataUrl.length > FEED_IMAGE_MAX_DATA_CHARS && q > 0.4) {
      q -= 0.1;
      dataUrl = canvas.toDataURL('image/jpeg', q);
    }
    if (dataUrl.length <= FEED_IMAGE_MAX_DATA_CHARS) return dataUrl;

    maxSide = Math.round(maxSide * 0.85);
    quality = FEED_IMAGE_JPEG_QUALITY;
  }

  throw new Error('Image trop volumineuse. Essayez une capture plus petite.');
}
