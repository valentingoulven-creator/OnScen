import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import {
  bitmapCropToProfileDataUrl,
  computeCropRectFromViewport,
  initialCoverScale,
} from '../lib/profileImageProcessing';
import {
  bitmapCropToFeedDataUrl,
  bitmapCropToStoryDataUrl,
  clampPanOffset,
  computeStoryCropRect,
  loadImageBitmapFromDataUrl,
  loadImageBitmapFromFile,
  STORY_VIEWPORT_H,
  STORY_VIEWPORT_W,
  zoomPanAtViewportPoint,
} from '../lib/storyImageCompose';
import type { PhotoCropAspect } from './StoryImageCropModal';

export interface InlineCropControls {
  apply: () => string | null;
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
  return Math.max(viewW / imgW, viewH / imgH);
}

function measureContainerSize(el: HTMLDivElement | null): { w: number; h: number } | null {
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return null;
  return { w: rect.width, h: rect.height };
}

function syncViewSizeFromContainer(
  el: HTMLDivElement | null,
  viewSizeRef: MutableRefObject<{ w: number; h: number }>,
  setViewSize: (size: { w: number; h: number }) => void
): boolean {
  const measured = measureContainerSize(el);
  if (!measured) return false;
  viewSizeRef.current = measured;
  setViewSize(measured);
  return true;
}

function pointerDistance(
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pointerCenter(
  a: { x: number; y: number },
  b: { x: number; y: number }
): { x: number; y: number } {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
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
  const [showHint, setShowHint] = useState(true);
  const scaleRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const panRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(
    null
  );
  const pinchRef = useRef<{
    distance: number;
    scale: number;
  } | null>(null);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

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
    syncViewSizeFromContainer(el, viewSizeRef, setViewSize);
    const ro = new ResizeObserver(() => {
      syncViewSizeFromContainer(el, viewSizeRef, setViewSize);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading]);

  useEffect(() => {
    let cancelled = false;
    let loaded: ImageBitmap | null = null;
    setLoading(true);
    setError(null);
    setShowHint(true);
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
        syncViewSizeFromContainer(containerRef.current, viewSizeRef, setViewSize);
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

  const clampScale = useCallback(
    (s: number) => Math.min(maxScale, Math.max(minScale, s)),
    [minScale, maxScale]
  );

  const applyPanZoom = useCallback(
    (nextScale: number, nextOffsetX: number, nextOffsetY: number) => {
      if (!bitmap) return;
      const clampedScale = clampScale(nextScale);
      const clamped = clampPanOffset(
        bitmap.width,
        bitmap.height,
        viewSize.w,
        viewSize.h,
        clampedScale,
        nextOffsetX,
        nextOffsetY
      );
      setScale(clampedScale);
      setOffset({ x: clamped.offsetX, y: clamped.offsetY });
    },
    [bitmap, clampScale, viewSize.w, viewSize.h]
  );

  const zoomAtPoint = useCallback(
    (nextScale: number, pointX: number, pointY: number) => {
      if (!bitmap) return;
      const clampedScale = clampScale(nextScale);
      const next = zoomPanAtViewportPoint(
        bitmap.width,
        bitmap.height,
        viewSize.w,
        viewSize.h,
        scaleRef.current,
        offsetRef.current.x,
        offsetRef.current.y,
        clampedScale,
        pointX,
        pointY
      );
      setScale(next.scale);
      setOffset({ x: next.offsetX, y: next.offsetY });
    },
    [bitmap, clampScale, viewSize.w, viewSize.h]
  );

  const localPoint = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: viewSize.w / 2, y: viewSize.h / 2 };
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const dismissHint = () => {
    setShowHint((prev) => (prev ? false : prev));
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !bitmap) return;
    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      dismissHint();
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
      zoomAtPoint(scaleRef.current * factor, x, y);
    };
    el.addEventListener('wheel', onWheelNative, { passive: false });
    return () => el.removeEventListener('wheel', onWheelNative);
  }, [bitmap, zoomAtPoint]);

  useEffect(() => {
    if (!bitmap) return;
    const newMin = initialScaleForAspect(aspect, bitmap.width, bitmap.height, viewSize.w, viewSize.h);
    const nextScale = Math.max(newMin, scaleRef.current);
    if (nextScale !== scaleRef.current) {
      setScale(nextScale);
    }
    const clamped = clampPanOffset(
      bitmap.width,
      bitmap.height,
      viewSize.w,
      viewSize.h,
      nextScale,
      offsetRef.current.x,
      offsetRef.current.y
    );
    if (clamped.offsetX !== offsetRef.current.x || clamped.offsetY !== offsetRef.current.y) {
      setOffset({ x: clamped.offsetX, y: clamped.offsetY });
    }
  }, [bitmap, aspect, viewSize.w, viewSize.h]);

  const syncPinch = () => {
    const pts = [...pointersRef.current.values()];
    if (pts.length !== 2 || !bitmap) return;
    const center = pointerCenter(pts[0], pts[1]);
    const distance = pointerDistance(pts[0], pts[1]);
    const pinch = pinchRef.current;
    if (!pinch || pinch.distance < 1) return;
    const factor = distance / pinch.distance;
    zoomAtPoint(pinch.scale * factor, center.x, center.y);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!bitmap) return;
    e.stopPropagation();
    dismissHint();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const pt = localPoint(e.clientX, e.clientY);
    pointersRef.current.set(e.pointerId, pt);

    if (pointersRef.current.size === 1) {
      panRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        baseX: offsetRef.current.x,
        baseY: offsetRef.current.y,
      };
      pinchRef.current = null;
      return;
    }

    if (pointersRef.current.size === 2) {
      const pts = [...pointersRef.current.values()];
      panRef.current = null;
      pinchRef.current = {
        distance: pointerDistance(pts[0], pts[1]),
        scale: scaleRef.current,
      };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!bitmap || !pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, localPoint(e.clientX, e.clientY));

    if (pointersRef.current.size >= 2) {
      if (!pinchRef.current) {
        const pts = [...pointersRef.current.values()];
        pinchRef.current = {
          distance: pointerDistance(pts[0], pts[1]),
          scale: scaleRef.current,
        };
      }
      syncPinch();
      return;
    }

    const pan = panRef.current;
    if (!pan) return;
    const dx = e.clientX - pan.startX;
    const dy = e.clientY - pan.startY;
    applyPanZoom(scaleRef.current, pan.baseX + dx, pan.baseY + dy);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 0) {
      panRef.current = null;
      return;
    }
    if (pointersRef.current.size === 1) {
      panRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        baseX: offsetRef.current.x,
        baseY: offsetRef.current.y,
      };
    }
  };

  const applyCrop = useCallback((): string | null => {
    if (!bitmap || exporting) return null;
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
      return dataUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rognage impossible');
      return null;
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
      exporting,
    });
  }, [bitmap, loading, error, exporting, applyCrop, onControlsChange]);

  const imageLayout = bitmap
    ? {
        width: bitmap.width * scale,
        height: bitmap.height * scale,
        transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
      }
    : null;

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
      className="absolute inset-0 touch-none select-none overflow-hidden cursor-grab active:cursor-grabbing"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="absolute left-1/2 top-1/2 pointer-events-none max-w-none"
        style={{
          width: imageLayout.width,
          height: imageLayout.height,
          transform: imageLayout.transform,
        }}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt=""
            draggable={false}
            className="w-full h-full max-w-none"
            style={{ filter: filterCss }}
          />
        ) : null}
      </div>

      <div className="absolute inset-0 pointer-events-none z-10" aria-hidden>
        <div className="absolute inset-0 border border-white/35" />
        <div className="absolute inset-x-0 top-1/3 border-t border-white/20" />
        <div className="absolute inset-x-0 top-2/3 border-t border-white/20" />
        <div className="absolute inset-y-0 left-1/3 border-l border-white/20" />
        <div className="absolute inset-y-0 left-2/3 border-l border-white/20" />
      </div>

      {showHint ? (
        <p className="absolute bottom-3 inset-x-0 z-20 pointer-events-none text-center text-[11px] text-white/55 drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
          Pincez ou glissez
        </p>
      ) : null}
    </div>
  );
}
