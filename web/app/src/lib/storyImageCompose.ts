import { getPhotoFilterCss, type PhotoFilterId } from './photoFilters';
import { applyStoryCanvasEffects, waveformSeedFromText } from './storyCanvasEffects';
import type { StoryCreativeEffectId } from './storyCreativeEffects';
import {
  resolveStoryTextFont,
  type StoryTextFontId,
} from './storyTextFonts';
import type { StoryTaggedUser } from '../types';
import type { StoryTextMentionRef } from './storyTextMention';
import {
  effectiveTagFontSize,
  effectiveTextFontSize,
} from './storyOverlayTransform';
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

export type StoryTextOverlayStyle = 'plain' | 'background' | 'outline';

export interface StoryTextOverlay {
  id: string;
  text: string;
  /** Position relative 0–1 sur l'image */
  x: number;
  y: number;
  color: string;
  fontSize: number;
  /** Facteur d'échelle visuel (0,5–2) appliqué au fontSize. */
  scale?: number;
  style?: StoryTextOverlayStyle;
  fontId?: StoryTextFontId;
  /** Utilisateurs tagués inline via @ dans ce texte (pas de sticker séparé). */
  mentionRefs?: StoryTextMentionRef[];
}

export function loadImageBitmapFromDataUrl(dataUrl: string): Promise<ImageBitmap> {
  return new Promise<ImageBitmap>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      createImageBitmap(img).then(resolve, () =>
        reject(new Error("Impossible de traiter l'image"))
      );
    };
    img.onerror = () => reject(new Error("Impossible de charger l'image"));
    img.src = dataUrl;
  });
}

export function dataUrlToFile(dataUrl: string, name = 'story.jpg'): File {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx < 0) throw new Error("Format de données invalide");
  const meta = dataUrl.slice(0, commaIdx);
  const mimeType = meta.match(/data:([^;,]+)/)?.[1] ?? 'image/jpeg';
  const rawData = dataUrl.slice(commaIdx + 1);
  const byteString = meta.includes(';base64') ? atob(rawData) : decodeURIComponent(rawData);
  const bytes = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) bytes[i] = byteString.charCodeAt(i);
  return new File([bytes], name, { type: mimeType });
}

/** Limite le décalage pour que l'image couvre toujours le viewport (pan type Insta/TikTok). */
export function clampPanOffset(
  imgW: number,
  imgH: number,
  viewportW: number,
  viewportH: number,
  scale: number,
  offsetX: number,
  offsetY: number
): { offsetX: number; offsetY: number } {
  const scaledW = imgW * scale;
  const scaledH = imgH * scale;
  const maxX = Math.max(0, (scaledW - viewportW) / 2);
  const maxY = Math.max(0, (scaledH - viewportH) / 2);
  return {
    offsetX: Math.min(maxX, Math.max(-maxX, offsetX)),
    offsetY: Math.min(maxY, Math.max(-maxY, offsetY)),
  };
}

/** Zoom autour d'un point viewport tout en conservant le pixel source sous le curseur. */
export function zoomPanAtViewportPoint(
  imgW: number,
  imgH: number,
  viewportW: number,
  viewportH: number,
  scale: number,
  offsetX: number,
  offsetY: number,
  nextScale: number,
  pointX: number,
  pointY: number
): { scale: number; offsetX: number; offsetY: number } {
  const left = (viewportW - imgW * scale) / 2 + offsetX;
  const top = (viewportH - imgH * scale) / 2 + offsetY;
  const imgX = (pointX - left) / scale;
  const imgY = (pointY - top) / scale;
  const newLeft = pointX - imgX * nextScale;
  const newTop = pointY - imgY * nextScale;
  const rawOffsetX = newLeft - (viewportW - imgW * nextScale) / 2;
  const rawOffsetY = newTop - (viewportH - imgH * nextScale) / 2;
  const clamped = clampPanOffset(
    imgW,
    imgH,
    viewportW,
    viewportH,
    nextScale,
    rawOffsetX,
    rawOffsetY
  );
  return { scale: nextScale, offsetX: clamped.offsetX, offsetY: clamped.offsetY };
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

/** Position par défaut pour un tag story (évite la superposition). */
export function defaultStoryTagPosition(
  index: number,
  _total: number
): { x: number; y: number } {
  const row = index % 3;
  const col = Math.floor(index / 3);
  const x = 0.35 + col * 0.15;
  const y = 0.22 + row * 0.12;
  return { x: Math.min(0.85, x), y: Math.min(0.88, y) };
}

export function resolveStoryTagPosition(
  tag: Pick<StoryTaggedUser, 'x' | 'y'>,
  index: number,
  total: number
): { x: number; y: number } {
  const fallback = defaultStoryTagPosition(index, total);
  return {
    x: tag.x ?? fallback.x,
    y: tag.y ?? fallback.y,
  };
}

function drawUserTagOverlays(
  ctx: CanvasRenderingContext2D,
  bitmap: ImageBitmap,
  tags: StoryTaggedUser[],
  referenceViewportW: number
): void {
  if (!tags.length) return;
  const rx = 8 * (bitmap.width / referenceViewportW);

  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i];
    const fontSize = Math.max(
      8,
      Math.round(
        effectiveTagFontSize(tag) * (13 / 11) * (bitmap.width / referenceViewportW)
      )
    );
    const { x, y } = resolveStoryTagPosition(tag, i, tags.length);
    const label = `@${tag.username}`;
    ctx.font = `600 ${fontSize}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const metrics = ctx.measureText(label);
    const padX = fontSize * 0.45;
    const padY = fontSize * 0.28;
    const w = metrics.width + padX * 2;
    const h = fontSize + padY * 2;
    const px = x * bitmap.width;
    const py = y * bitmap.height;

    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.roundRect(px - w / 2, py - h / 2, w, h, rx);
    ctx.fill();

    ctx.fillStyle = '#111111';
    ctx.fillText(label, px, py);
  }
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
    const size = Math.max(
      12,
      Math.round(effectiveTextFontSize(o) * (bitmap.width / referenceViewportW))
    );
    const style = o.style ?? 'plain';
    const font = resolveStoryTextFont(o.fontId);
    ctx.font = `${font.fontWeight} ${size}px ${font.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const px = o.x * bitmap.width;
    const py = o.y * bitmap.height;

    if (style === 'background') {
      const metrics = ctx.measureText(text);
      const padX = size * 0.35;
      const padY = size * 0.2;
      const w = metrics.width + padX * 2;
      const h = size + padY * 2;
      const rx = 6 * (bitmap.width / referenceViewportW);
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.beginPath();
      ctx.roundRect(px - w / 2, py - h / 2, w, h, rx);
      ctx.fill();
      ctx.fillStyle = '#111111';
      ctx.fillText(text, px, py);
      continue;
    }

    if (style === 'outline') {
      ctx.lineWidth = Math.max(2, size / 14);
      ctx.strokeStyle = o.color;
      ctx.lineJoin = 'round';
      ctx.strokeText(text, px, py);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(text, px, py);
      continue;
    }

    ctx.fillStyle = o.color;
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = Math.max(2, size / 8);
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;
    ctx.fillText(text, px, py);
    ctx.shadowBlur = 0;
  }
}

/** Applique filtre + calques texte sur l'image (positions relatives 0–1). */
export async function composePhotoImageWithEdits(
  imageDataUrl: string,
  overlays: StoryTextOverlay[],
  filterId: PhotoFilterId = 'none',
  options?: {
    referenceViewportW?: number;
    quality?: number;
    taggedUsers?: StoryTaggedUser[];
    storyEffect?: StoryCreativeEffectId;
    duotoneGenre?: string | null;
    waveformSeed?: string | null;
  }
): Promise<string> {
  const referenceViewportW = options?.referenceViewportW ?? STORY_VIEWPORT_W;
  const quality = options?.quality ?? STORY_JPEG_QUALITY;
  const taggedUsers = options?.taggedUsers ?? [];
  const storyEffect = options?.storyEffect ?? 'none';
  const cssFilter = getPhotoFilterCss(filterId);
  const useGlitch = storyEffect === 'glitch';
  const useDuotone = storyEffect === 'duotone';
  const useWaveform = storyEffect === 'waveform';
  const hasCanvasFx = useGlitch || useDuotone || useWaveform;
  const hasEdits =
    overlays.some((o) => o.text.trim()) ||
    cssFilter !== 'none' ||
    taggedUsers.length > 0 ||
    hasCanvasFx;
  const bitmap = await loadImageBitmapFromDataUrl(imageDataUrl);
  if (!hasEdits) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Impossible de traiter l'image");
      ctx.drawImage(bitmap, 0, 0);
      return canvas.toDataURL('image/jpeg', quality);
    } finally {
      bitmap.close();
    }
  }
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Impossible de composer l'image");

    if (hasCanvasFx) {
      applyStoryCanvasEffects(ctx, bitmap, bitmap.width, bitmap.height, {
        cssFilter: useGlitch ? 'none' : cssFilter,
        glitch: useGlitch,
        duotoneGenre: useDuotone ? options?.duotoneGenre ?? 'default' : null,
        waveformSeed: useWaveform
          ? options?.waveformSeed ?? waveformSeedFromText('soundy')
          : null,
      });
    } else {
      if (cssFilter !== 'none') ctx.filter = cssFilter;
      ctx.drawImage(bitmap, 0, 0);
      ctx.filter = 'none';
    }
    drawTextOverlays(ctx, bitmap, overlays, referenceViewportW);
    drawUserTagOverlays(ctx, bitmap, taggedUsers, referenceViewportW);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    bitmap.close();
  }
}

/** Compose les calques texte sur l'image story (positions relatives 0–1). */
export async function composeStoryImageWithOverlays(
  imageDataUrl: string,
  overlays: StoryTextOverlay[],
  filterId: PhotoFilterId = 'none',
  taggedUsers: StoryTaggedUser[] = [],
  effectOptions?: {
    storyEffect?: StoryCreativeEffectId;
    duotoneGenre?: string | null;
    waveformSeed?: string | null;
  }
): Promise<string> {
  return composePhotoImageWithEdits(imageDataUrl, overlays, filterId, {
    referenceViewportW: STORY_VIEWPORT_W,
    quality: STORY_JPEG_QUALITY,
    taggedUsers,
    storyEffect: effectOptions?.storyEffect,
    duotoneGenre: effectOptions?.duotoneGenre,
    waveformSeed: effectOptions?.waveformSeed,
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
