import { getPhotoFilterCss, type PhotoFilterId } from './photoFilters';
import {
  computeCropRectFromViewport,
  initialCoverScale,
  loadImageBitmapFromFile,
  PROFILE_PHOTO_JPEG_QUALITY,
  type CropRect,
} from './profileImageProcessing';

export const STORY_VIEWPORT_W = 280;
export const STORY_VIEWPORT_H = Math.round((STORY_VIEWPORT_W * 16) / 9);
export const FEED_VIEWPORT_W = 280;
export const FEED_VIEWPORT_H = Math.round((FEED_VIEWPORT_W * 5) / 4);
export const PROFILE_VIEWPORT_PX = 280;
export const STORY_MAX_WIDTH = 1080;
export const FEED_MAX_WIDTH = 1080;
/** Qualité JPEG story conforme aux specs Instagram (0.85) */
export const STORY_JPEG_QUALITY = 0.85;
/** Qualité JPEG publication fil conforme aux specs Instagram (0.85) */
export const FEED_JPEG_QUALITY = 0.85;

export interface StoryTextOverlay {
  id: string;
  text: string;
  /** Position relative 0–1 sur l'image */
  x: number;
  y: number;
  color: string;
  fontSize: number;
}

export async function loadImageBitmapFromDataUrl(dataUrl: string): Promise<ImageBitmap> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return createImageBitmap(blob);
}

export async function dataUrlToFile(dataUrl: string, name = 'story.jpg'): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], name, { type: blob.type || 'image/jpeg' });
}

/** Zone source pour un viewport rectangulaire (story 9:16). */
export function computeStoryCropRect(
  imgW: number,
  imgH: number,
  viewportW: number,
  viewportH: number,
  scale: number,
  offsetX: number,
  offsetY: number
): CropRect {
  const scaledW = imgW * scale;
  const scaledH = imgH * scale;
  const left = (viewportW - scaledW) / 2 + offsetX;
  const top = (viewportH - scaledH) / 2 + offsetY;

  const sx = Math.max(0, (0 - left) / scale);
  const sy = Math.max(0, (0 - top) / scale);
  const sw = Math.min(imgW - sx, viewportW / scale);
  const sh = Math.min(imgH - sy, viewportH / scale);

  return {
    sx: Math.round(sx),
    sy: Math.round(sy),
    sw: Math.max(1, Math.round(sw)),
    sh: Math.max(1, Math.round(sh)),
  };
}

export function initialStoryCoverScale(imgW: number, imgH: number): number {
  return Math.max(STORY_VIEWPORT_W / imgW, STORY_VIEWPORT_H / imgH);
}

export function initialFeedCoverScale(imgW: number, imgH: number): number {
  return Math.max(FEED_VIEWPORT_W / imgW, FEED_VIEWPORT_H / imgH);
}

export function bitmapCropToStoryDataUrl(
  bitmap: ImageBitmap,
  crop: CropRect,
  maxW = STORY_MAX_WIDTH,
  quality = STORY_JPEG_QUALITY
): string {
  const aspect = crop.sw / crop.sh;
  let outW = Math.min(maxW, crop.sw);
  let outH = outW / aspect;
  const maxH = Math.round((maxW * 16) / 9);
  if (outH > maxH) {
    outH = maxH;
    outW = outH * aspect;
  }
  outW = Math.round(outW);
  outH = Math.round(outH);

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error("Impossible de traiter l'image");
  ctx.drawImage(bitmap, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, outW, outH);
  return canvas.toDataURL('image/jpeg', quality);
}

export function bitmapCropToFeedDataUrl(
  bitmap: ImageBitmap,
  crop: CropRect,
  maxW = FEED_MAX_WIDTH,
  quality = FEED_JPEG_QUALITY
): string {
  const aspect = crop.sw / crop.sh;
  let outW = Math.min(maxW, crop.sw);
  let outH = outW / aspect;
  const maxH = Math.round((maxW * 5) / 4);
  if (outH > maxH) {
    outH = maxH;
    outW = outH * aspect;
  }
  outW = Math.round(outW);
  outH = Math.round(outH);

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error("Impossible de traiter l'image");
  ctx.drawImage(bitmap, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, outW, outH);
  return canvas.toDataURL('image/jpeg', quality);
}

function drawTextOverlays(
  ctx: CanvasRenderingContext2D,
  bitmap: ImageBitmap,
  overlays: StoryTextOverlay[],
  referenceViewportW: number
): void {
  for (const o of overlays) {
    const text = o.text.trim();
    if (!text) continue;
    const size = Math.max(12, Math.round(o.fontSize * (bitmap.width / referenceViewportW)));
    ctx.font = `bold ${size}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = o.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = Math.max(2, size / 8);
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;
    const px = o.x * bitmap.width;
    const py = o.y * bitmap.height;
    ctx.fillText(text, px, py);
  }
}

/** Applique filtre + calques texte sur l'image (positions relatives 0–1). */
export async function composePhotoImageWithEdits(
  imageDataUrl: string,
  overlays: StoryTextOverlay[],
  filterId: PhotoFilterId = 'none',
  options?: { referenceViewportW?: number; quality?: number }
): Promise<string> {
  const referenceViewportW = options?.referenceViewportW ?? STORY_VIEWPORT_W;
  const quality = options?.quality ?? STORY_JPEG_QUALITY;
  const cssFilter = getPhotoFilterCss(filterId);
  const hasEdits = overlays.some((o) => o.text.trim()) || cssFilter !== 'none';
  if (!hasEdits) return imageDataUrl;

  const bitmap = await loadImageBitmapFromDataUrl(imageDataUrl);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Impossible de composer l'image");

    if (cssFilter !== 'none') ctx.filter = cssFilter;
    ctx.drawImage(bitmap, 0, 0);
    ctx.filter = 'none';
    drawTextOverlays(ctx, bitmap, overlays, referenceViewportW);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    bitmap.close();
  }
}

/** Compose les calques texte sur l'image story (positions relatives 0–1). */
export async function composeStoryImageWithOverlays(
  imageDataUrl: string,
  overlays: StoryTextOverlay[],
  filterId: PhotoFilterId = 'none'
): Promise<string> {
  return composePhotoImageWithEdits(imageDataUrl, overlays, filterId, {
    referenceViewportW: STORY_VIEWPORT_W,
    quality: STORY_JPEG_QUALITY,
  });
}

/** Compose filtre + texte pour photo de profil carrée. */
export async function composeProfileImageWithEdits(
  imageDataUrl: string,
  overlays: StoryTextOverlay[],
  filterId: PhotoFilterId = 'none'
): Promise<string> {
  return composePhotoImageWithEdits(imageDataUrl, overlays, filterId, {
    referenceViewportW: PROFILE_VIEWPORT_PX,
    quality: PROFILE_PHOTO_JPEG_QUALITY,
  });
}

/** Compose filtre + texte pour publication fil (4:5). */
export async function composeFeedImageWithEdits(
  imageDataUrl: string,
  overlays: StoryTextOverlay[],
  filterId: PhotoFilterId = 'none'
): Promise<string> {
  return composePhotoImageWithEdits(imageDataUrl, overlays, filterId, {
    referenceViewportW: FEED_VIEWPORT_W,
    quality: FEED_JPEG_QUALITY,
  });
}

export { loadImageBitmapFromFile, computeCropRectFromViewport, initialCoverScale };
