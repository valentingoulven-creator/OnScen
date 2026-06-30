import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { canUploadSponsorAsset } from '../lib/sponsorUploadAuth';
import {
  resolveSponsorBannerSrc,
  SPONSOR_BANNER_ACCEPT,
  SPONSOR_BANNER_OUTPUT_H,
  SPONSOR_BANNER_OUTPUT_W,
  validateSponsorBannerFile,
} from '../lib/sponsorBannerUpload';
import { SponsorBannerCropModal } from './SponsorBannerCropModal';

type SponsorBannerUploadFieldProps = {
  bannerImageUrl: string;
  onBannerImageUrlChange: (url: string) => void;
  inputId: string;
};

export function SponsorBannerUploadField({
  bannerImageUrl,
  onBannerImageUrlChange,
  inputId,
}: SponsorBannerUploadFieldProps) {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const sessionReady = Boolean(user);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const uploadDataUrl = async (dataUrl: string) => {
    if (!sessionReady) return;
    setUploading(true);
    setError('');
    try {
      const { url } = await api.uploadAdminSponsorBanner(token, dataUrl);
      onBannerImageUrlChange(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('admin.sponsors.bannerUploadError'));
    } finally {
      setUploading(false);
    }
  };

  const handleFile = (file: File | undefined) => {
    if (!file || !sessionReady) return;
    const validationError = validateSponsorBannerFile(file);
    if (validationError) {
      setError(validationError);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setError('');
    setPendingFile(file);
  };

  const handleCropConfirm = (dataUrl: string) => {
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    void uploadDataUrl(dataUrl);
  };

  const handleCropCancel = () => {
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const previewSrc = resolveSponsorBannerSrc(bannerImageUrl) || undefined;
  const canUpload = canUploadSponsorAsset(sessionReady, uploading);

  return (
    <>
      <div className="block text-xs text-gray-400">
        <span className="block mb-1.5">{t('admin.sponsors.fieldBannerImage')}</span>
        <div className="flex items-start gap-3">
          <div
            className="rounded-xl border border-[#2d2d3d] bg-[#1a1a26] overflow-hidden shrink-0 flex items-center justify-center"
            style={{ width: SPONSOR_BANNER_OUTPUT_W / 4, height: SPONSOR_BANNER_OUTPUT_H / 4 }}
          >
            {previewSrc ? (
              <img src={previewSrc} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[10px] text-gray-500 text-center px-1 leading-tight">
                {SPONSOR_BANNER_OUTPUT_W}×{SPONSOR_BANNER_OUTPUT_H}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0 space-y-1.5">
            <input
              ref={fileInputRef}
              id={inputId}
              type="file"
              accept={SPONSOR_BANNER_ACCEPT}
              className="hidden"
              disabled={!canUpload}
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <button
              type="button"
              disabled={!canUpload}
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2 rounded-xl bg-purple-600/20 border border-purple-500/35 text-purple-200 text-xs font-semibold hover:bg-purple-600/30 disabled:opacity-50 transition"
            >
              {uploading
                ? t('admin.sponsors.bannerUploading')
                : previewSrc
                  ? t('admin.sponsors.bannerReplace')
                  : t('admin.sponsors.bannerImport')}
            </button>
            {bannerImageUrl.trim() && (
              <button
                type="button"
                disabled={uploading}
                onClick={() => onBannerImageUrlChange('')}
                className="block text-[11px] text-gray-500 hover:text-red-400 transition disabled:opacity-50"
              >
                {t('admin.sponsors.bannerRemove')}
              </button>
            )}
            {error ? (
              <p className="text-[11px] text-red-400 leading-snug">{error}</p>
            ) : (
              <p className="text-[11px] text-gray-500 leading-snug">{t('admin.sponsors.bannerHint')}</p>
            )}
          </div>
        </div>
      </div>

      {pendingFile ? (
        <SponsorBannerCropModal
          file={pendingFile}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      ) : null}
    </>
  );
}
