import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  computeSponsorBannerCropRect,
  exportSponsorBannerDataUrl,
  initialSponsorBannerCoverScale,
  loadSponsorBannerBitmap,
  SPONSOR_BANNER_CROP_VIEWPORT_H,
  SPONSOR_BANNER_CROP_VIEWPORT_W,
  validateSponsorBannerFile,
} from '../lib/sponsorBannerUpload';

interface SponsorBannerCropModalProps {
  file: File;
  onConfirm: (dataUrl: string) => void;
  onCancel: () => void;
}

export function SponsorBannerCropModal({ file, onConfirm, onCancel }: SponsorBannerCropModalProps) {
  const { t } = useTranslation();
  const viewportW = SPONSOR_BANNER_CROP_VIEWPORT_W;
  const viewportH = SPONSOR_BANNER_CROP_VIEWPORT_H;
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(
    null
  );

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    let cancelled = false;
    let loaded: ImageBitmap | null = null;
    setLoading(true);
    setError(null);

    const validationError = validateSponsorBannerFile(file);
    if (validationError) {
      setError(validationError);
      setLoading(false);
      return;
    }

    void loadSponsorBannerBitmap(file)
      .then((bmp) => {
        if (cancelled) {
          bmp.close();
          return;
        }
        loaded = bmp;
        const base = initialSponsorBannerCoverScale(bmp.width, bmp.height);
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
  }, [file]);

  useEffect(() => {
    return () => {
      bitmap?.close();
    };
  }, [bitmap]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!bitmap) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseX: offset.x,
      baseY: offset.y,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    setOffset({
      x: d.baseX + (e.clientX - d.startX),
      y: d.baseY + (e.clientY - d.startY),
    });
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const confirm = useCallback(() => {
    if (!bitmap) return;
    setExporting(true);
    try {
      const crop = computeSponsorBannerCropRect(bitmap.width, bitmap.height, scale, offset.x, offset.y);
      const dataUrl = exportSponsorBannerDataUrl(bitmap, crop);
      onConfirm(dataUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rognage impossible');
    } finally {
      setExporting(false);
    }
  }, [bitmap, scale, offset, onConfirm]);

  const minScale = bitmap ? initialSponsorBannerCoverScale(bitmap.width, bitmap.height) : 1;
  const maxScale = minScale * 4;

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/85 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sponsor-banner-crop-title"
    >
      <div className="w-full max-w-md bg-[#12121a] border border-[#2d2d3d] rounded-2xl p-4 space-y-4 shadow-2xl">
        <h2 id="sponsor-banner-crop-title" className="text-lg font-bold text-white text-center">
          {t('admin.sponsors.bannerCropTitle')}
        </h2>
        <p className="text-xs text-gray-400 text-center">{t('admin.sponsors.bannerCropHint')}</p>

        {loading && <p className="text-center text-gray-500 text-sm py-16">Chargement…</p>}
        {error && <p className="text-center text-red-400 text-sm">{error}</p>}

        {!loading && bitmap && (
          <>
            <div
              className="relative mx-auto rounded-xl overflow-hidden border-2 border-purple-500/50 bg-[#0b0b0f] touch-none select-none"
              style={{ width: viewportW, height: viewportH }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt=""
                  draggable={false}
                  className="absolute max-w-none pointer-events-none"
                  style={{
                    width: bitmap.width * scale,
                    height: bitmap.height * scale,
                    left: (viewportW - bitmap.width * scale) / 2 + offset.x,
                    top: (viewportH - bitmap.height * scale) / 2 + offset.y,
                  }}
                />
              )}
              <div
                className="absolute inset-0 pointer-events-none ring-2 ring-inset ring-white/30"
                aria-hidden
              />
            </div>

            <label className="block">
              <span className="text-xs text-gray-400">{t('admin.sponsors.bannerCropZoom')}</span>
              <input
                type="range"
                min={minScale}
                max={maxScale}
                step={0.01}
                value={scale}
                onChange={(e) => setScale(Number(e.target.value))}
                className="w-full mt-1 accent-purple-500"
              />
            </label>
          </>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl border border-[#2d2d3d] text-gray-300 font-semibold text-sm"
          >
            {t('admin.sponsors.bannerCropCancel')}
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!bitmap || loading || exporting || Boolean(error)}
            className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm disabled:opacity-50"
          >
            {exporting ? '…' : t('admin.sponsors.bannerCropConfirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
