import { useCallback, useEffect, useRef, useState } from 'react';
import {
  bitmapCropToProfileDataUrl,
  computeCropRectFromViewport,
  initialCoverScale,
} from '../lib/profileImageProcessing';
import {
  bitmapCropToFeedDataUrl,
  bitmapCropToStoryDataUrl,
  computeStoryCropRect,
  loadImageBitmapFromDataUrl,
  loadImageBitmapFromFile,
  STORY_VIEWPORT_H,
  STORY_VIEWPORT_W,
} from '../lib/storyImageCompose';
import type { PhotoCropAspect } from './StoryImageCropModal';

type CropHandle =
  | 'move'
  | 'nw'
  | 'n'
  | 'ne'
  | 'e'
  | 'se'
  | 's'
  | 'sw'
  | 'w';

export interface InlineCropControls {
  apply: () => void;
  scale: number;
  minScale: number;
  maxScale: number;
  setScale: (scale: number) => void;
  exporting: boolean;
}

interface PhotoInlineCropProps {
  source: File | string;
  aspect: PhotoCropAspect;
  filterCss: string;
  onApply: (dataUrl: string) => void;
  onControlsChange?: (controls: InlineCropControls | null) => void;
}

function initialScaleForAspect(
  aspect: PhotoCropAspect,
  imgW: number,
  imgH: number,
  viewW: number,
  viewH: number
): number {
  if (aspect === 'profile') {
    return initialCoverScale(imgW, imgH, Math.min(viewW, viewH));
  }
  if (aspect === 'feed') {
    return Math.max(viewW / imgW, viewH / imgH);
  }
  return Math.max(viewW / imgW, viewH / imgH);
}

function anchorForHandle(handle: CropHandle): { x: number; y: number } {
  switch (handle) {
    case 'nw':
      return { x: 1, y: 1 };
    case 'n':
      return { x: 0.5, y: 1 };
    case 'ne':
      return { x: 0, y: 1 };
    case 'e':
      return { x: 0, y: 0.5 };
    case 'se':
      return { x: 0, y: 0 };
    case 's':
      return { x: 0.5, y: 0 };
    case 'sw':
      return { x: 1, y: 0 };
    case 'w':
      return { x: 1, y: 0.5 };
    default:
      return { x: 0.5, y: 0.5 };
  }
}

function scaleFromHandleDrag(
  handle: CropHandle,
  dx: number,
  dy: number,
  viewW: number,
  viewH: number
): number {
  const corner = handle === 'nw' || handle === 'ne' || handle === 'se' || handle === 'sw';
  if (corner) {
    const diagonal = Math.hypot(viewW, viewH);
    const delta =
      handle === 'se'
        ? dx + dy
        : handle === 'nw'
          ? -dx - dy
          : handle === 'ne'
            ? -dx + dy
            : dx - dy;
    return 1 + delta / (diagonal * 0.85);
  }
  if (handle === 'e' || handle === 'w') {
    const sign = handle === 'e' ? 1 : -1;
    return 1 + (sign * dx) / (viewW * 0.85);
  }
  const sign = handle === 's' ? 1 : -1;
  return 1 + (sign * dy) / (viewH * 0.85);
}

function offsetForAnchor(
  imgW: number,
  imgH: number,
  viewW: number,
  viewH: number,
  scale: number,
  anchorX: number,
  anchorY: number,
  anchorImgX: number,
  anchorImgY: number
): { x: number; y: number } {
  const scaledW = imgW * scale;
  const scaledH = imgH * scale;
  const left = anchorX * viewW - anchorImgX * scale;
  const top = anchorY * viewH - anchorImgY * scale;
  return {
    x: left - (viewW - scaledW) / 2,
    y: top - (viewH - scaledH) / 2,
  };
}

function Handle({
  position,
  onPointerDown,
}: {
  position: CropHandle;
  onPointerDown: (e: React.PointerEvent, handle: CropHandle) => void;
}) {
  const base =
    'absolute z-20 touch-none flex items-center justify-center w-7 h-7 -m-3.5';
  const pos: Record<CropHandle, string> = {
    move: '',
    nw: 'top-0 left-0 cursor-nwse-resize',
    n: 'top-0 left-1/2 -translate-x-1/2 cursor-ns-resize',
    ne: 'top-0 right-0 cursor-nesw-resize',
    e: 'top-1/2 right-0 -translate-y-1/2 cursor-ew-resize',
    se: 'bottom-0 right-0 cursor-nwse-resize',
    s: 'bottom-0 left-1/2 -translate-x-1/2 cursor-ns-resize',
    sw: 'bottom-0 left-0 cursor-nesw-resize',
    w: 'top-1/2 left-0 -translate-y-1/2 cursor-ew-resize',
  };

  if (position === 'move') return null;

  const isCorner = position === 'nw' || position === 'ne' || position === 'se' || position === 'sw';

  return (
    <div
      className={`${base} ${pos[position]}`}
      onPointerDown={(e) => onPointerDown(e, position)}
      role="presentation"
    >
      {isCorner ? (
        <span
          className={`block w-4 h-4 border-white ${
            position === 'nw'
              ? 'border-t-[3px] border-l-[3px]'
              : position === 'ne'
                ? 'border-t-[3px] border-r-[3px]'
                : position === 'se'
                  ? 'border-b-[3px] border-r-[3px]'
                  : 'border-b-[3px] border-l-[3px]'
          }`}
          aria-hidden
        />
      ) : (
        <span className="block w-2.5 h-2.5 rounded-full bg-white shadow-md" aria-hidden />
      )}
    </div>
  );
}

export function PhotoInlineCrop({
  source,
  aspect,
  filterCss,
  onApply,
  onControlsChange,
}: PhotoInlineCropProps) {
  const isProfile = aspect === 'profile';
  const isFeed = aspect === 'feed';
  const containerRef = useRef<HTMLDivElement>(null);
  const viewSizeRef = useRef({ w: STORY_VIEWPORT_W, h: STORY_VIEWPORT_H });
  const [viewSize, setViewSize] = useState({ w: STORY_VIEWPORT_W, h: STORY_VIEWPORT_H });
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const dragRef = useRef<{
    handle: CropHandle;
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
    baseScale: number;
    anchorImgX: number;
    anchorImgY: number;
  } | null>(null);

  useEffect(() => {
    if (typeof source === 'string') {
      setPreviewUrl(source);
      return;
    }
    const url = URL.createObjectURL(source);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [source]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect || rect.width < 1 || rect.height < 1) return;
      viewSizeRef.current = { w: rect.width, h: rect.height };
      setViewSize({ w: rect.width, h: rect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let loaded: ImageBitmap | null = null;
    setLoading(true);
    setError(null);
    const load =
      typeof source === 'string'
        ? loadImageBitmapFromDataUrl(source)
        : loadImageBitmapFromFile(source);
    void load
      .then((bmp) => {
        if (cancelled) {
          bmp.close();
          return;
        }
        loaded = bmp;
        const { w, h } = viewSizeRef.current;
        const base = initialScaleForAspect(aspect, bmp.width, bmp.height, w, h);
        setBitmap(bmp);
        setScale(base);
        setOffset({ x: 0, y: 0 });
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Image invalide');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      loaded?.close();
    };
  }, [source, aspect]);

  useEffect(() => {
    return () => {
      bitmap?.close();
    };
  }, [bitmap]);

  const minScale = bitmap
    ? initialScaleForAspect(aspect, bitmap.width, bitmap.height, viewSize.w, viewSize.h)
    : 1;
  const maxScale = minScale * 4;

  const clampScale = (s: number) => Math.min(maxScale, Math.max(minScale, s));

  const imageLayout = bitmap
    ? {
        width: bitmap.width * scale,
        height: bitmap.height * scale,
        left: (viewSize.w - bitmap.width * scale) / 2 + offset.x,
        top: (viewSize.h - bitmap.height * scale) / 2 + offset.y,
      }
    : null;

  const onPointerDown = (e: React.PointerEvent, handle: CropHandle) => {
    if (!bitmap || !imageLayout) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    let anchorImgX = bitmap.width / 2;
    let anchorImgY = bitmap.height / 2;
    if (handle !== 'move') {
      const anchor = anchorForHandle(handle);
      const scaledW = bitmap.width * scale;
      const scaledH = bitmap.height * scale;
      const left = (viewSize.w - scaledW) / 2 + offset.x;
      const top = (viewSize.h - scaledH) / 2 + offset.y;
      anchorImgX = (anchor.x * viewSize.w - left) / scale;
      anchorImgY = (anchor.y * viewSize.h - top) / scale;
    }

    dragRef.current = {
      handle,
      startX: e.clientX,
      startY: e.clientY,
      baseX: offset.x,
      baseY: offset.y,
      baseScale: scale,
      anchorImgX,
      anchorImgY,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || !bitmap) return;

    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;

    if (d.handle === 'move') {
      setOffset({ x: d.baseX + dx, y: d.baseY + dy });
      return;
    }

    const factor = scaleFromHandleDrag(d.handle, dx, dy, viewSize.w, viewSize.h);
    const newScale = clampScale(d.baseScale * factor);
    const anchor = anchorForHandle(d.handle);
    const next = offsetForAnchor(
      bitmap.width,
      bitmap.height,
      viewSize.w,
      viewSize.h,
      newScale,
      anchor.x,
      anchor.y,
      d.anchorImgX,
      d.anchorImgY
    );
    setScale(newScale);
    setOffset(next);
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const setScaleCentered = useCallback(
    (next: number) => {
      if (!bitmap) return;
      const clamped = clampScale(next);
      const anchor = { x: 0.5, y: 0.5 };
      const scaledW = bitmap.width * scale;
      const scaledH = bitmap.height * scale;
      const left = (viewSize.w - scaledW) / 2 + offset.x;
      const top = (viewSize.h - scaledH) / 2 + offset.y;
      const anchorImgX = (anchor.x * viewSize.w - left) / scale;
      const anchorImgY = (anchor.y * viewSize.h - top) / scale;
      const nextOffset = offsetForAnchor(
        bitmap.width,
        bitmap.height,
        viewSize.w,
        viewSize.h,
        clamped,
        anchor.x,
        anchor.y,
        anchorImgX,
        anchorImgY
      );
      setScale(clamped);
      setOffset(nextOffset);
    },
    [bitmap, scale, offset, viewSize.w, viewSize.h, minScale, maxScale]
  );

  const applyCrop = useCallback(() => {
    if (!bitmap || exporting) return;
    setExporting(true);
    try {
      const crop = isProfile
        ? computeCropRectFromViewport(
            bitmap.width,
            bitmap.height,
            Math.min(viewSize.w, viewSize.h),
            scale,
            offset.x,
            offset.y
          )
        : computeStoryCropRect(
            bitmap.width,
            bitmap.height,
            viewSize.w,
            viewSize.h,
            scale,
            offset.x,
            offset.y
          );
      const dataUrl = isProfile
        ? bitmapCropToProfileDataUrl(bitmap, crop)
        : isFeed
          ? bitmapCropToFeedDataUrl(bitmap, crop)
          : bitmapCropToStoryDataUrl(bitmap, crop);
      onApply(dataUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rognage impossible');
    } finally {
      setExporting(false);
    }
  }, [bitmap, scale, offset, onApply, isProfile, isFeed, viewSize.w, viewSize.h, exporting]);

  useEffect(() => {
    if (!bitmap || loading || error) {
      onControlsChange?.(null);
      return;
    }
    onControlsChange?.({
      apply: applyCrop,
      scale,
      minScale,
      maxScale,
      setScale: setScaleCentered,
      exporting,
    });
  }, [
    bitmap,
    loading,
    error,
    scale,
    minScale,
    maxScale,
    exporting,
    applyCrop,
    setScaleCentered,
    onControlsChange,
  ]);

  if (loading) {
    return (
      <div
        ref={containerRef}
        className="absolute inset-0 flex items-center justify-center bg-black/40"
      >
        <span className="text-xs text-gray-400">Chargement…</span>
      </div>
    );
  }

  if (error || !bitmap || !imageLayout) {
    return (
      <div
        ref={containerRef}
        className="absolute inset-0 flex items-center justify-center bg-black/40 px-4"
      >
        <span className="text-xs text-red-400 text-center">{error ?? 'Image invalide'}</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 touch-none select-none overflow-hidden"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="absolute cursor-grab active:cursor-grabbing"
        style={{
          width: imageLayout.width,
          height: imageLayout.height,
          left: imageLayout.left,
          top: imageLayout.top,
        }}
        onPointerDown={(e) => onPointerDown(e, 'move')}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt=""
            draggable={false}
            className="w-full h-full max-w-none pointer-events-none"
            style={{ filter: filterCss }}
          />
        ) : null}
      </div>

      <div className="absolute inset-0 pointer-events-none z-10" aria-hidden>
        <div className="absolute inset-0 border-2 border-white/90" />
        <div className="absolute inset-x-0 top-1/3 border-t border-white/25" />
        <div className="absolute inset-x-0 top-2/3 border-t border-white/25" />
        <div className="absolute inset-y-0 left-1/3 border-l border-white/25" />
        <div className="absolute inset-y-0 left-2/3 border-l border-white/25" />
      </div>

      {(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const).map((h) => (
        <Handle key={h} position={h} onPointerDown={onPointerDown} />
      ))}
    </div>
  );
}
