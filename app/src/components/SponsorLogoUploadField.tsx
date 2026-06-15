import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../lib/api';
import {
  resolveSponsorLogoSrc,
  SPONSOR_LOGO_ACCEPT,
  SPONSOR_LOGO_OUTPUT_PX,
  validateSponsorLogoFile,
} from '../lib/sponsorLogoUpload';
import { SponsorLogoCropModal } from './SponsorLogoCropModal';

type SponsorLogoUploadFieldProps = {
  token: string | null;
  logoUrl: string;
  onLogoUrlChange: (url: string) => void;
  inputId: string;
};

export function SponsorLogoUploadField({
  token,
  logoUrl,
  onLogoUrlChange,
  inputId,
}: SponsorLogoUploadFieldProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const uploadDataUrl = async (dataUrl: string) => {
    if (!token) return;
    setUploading(true);
    setError('');
    try {
      const { url } = await api.uploadAdminSponsorLogo(token, dataUrl);
      onLogoUrlChange(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('admin.sponsors.logoUploadError'));
    } finally {
      setUploading(false);
    }
  };

  const handleFile = (file: File | undefined) => {
    if (!file || !token) return;
    const validationError = validateSponsorLogoFile(file);
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

  const previewSrc = resolveSponsorLogoSrc(logoUrl) || undefined;

  return (
    <>
      <div className="block text-xs text-gray-400">
        <span className="block mb-1.5">{t('admin.sponsors.fieldLogo')}</span>
        <div className="flex items-start gap-3">
          <div
            className="w-20 h-20 rounded-xl border border-[#2d2d3d] bg-[#1a1a26] overflow-hidden shrink-0 flex items-center justify-center"
            style={{ width: SPONSOR_LOGO_OUTPUT_PX, height: SPONSOR_LOGO_OUTPUT_PX }}
          >
            {previewSrc ? (
              <img src={previewSrc} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[10px] text-gray-500 text-center px-1 leading-tight">
                {SPONSOR_LOGO_OUTPUT_PX}×{SPONSOR_LOGO_OUTPUT_PX}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0 space-y-1.5">
            <input
              ref={fileInputRef}
              id={inputId}
              type="file"
              accept={SPONSOR_LOGO_ACCEPT}
              className="hidden"
              disabled={uploading || !token}
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <button
              type="button"
              disabled={uploading || !token}
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2 rounded-xl bg-purple-600/20 border border-purple-500/35 text-purple-200 text-xs font-semibold hover:bg-purple-600/30 disabled:opacity-50 transition"
            >
              {uploading
                ? t('admin.sponsors.logoUploading')
                : previewSrc
                  ? t('admin.sponsors.logoReplace')
                  : t('admin.sponsors.logoImport')}
            </button>
            {logoUrl.trim() && (
              <button
                type="button"
                disabled={uploading}
                onClick={() => onLogoUrlChange('')}
                className="block text-[11px] text-gray-500 hover:text-red-400 transition disabled:opacity-50"
              >
                {t('admin.sponsors.logoRemove')}
              </button>
            )}
            {error ? (
              <p className="text-[11px] text-red-400 leading-snug">{error}</p>
            ) : (
              <p className="text-[11px] text-gray-500 leading-snug">
                {t('admin.sponsors.logoHint')}
              </p>
            )}
          </div>
        </div>
      </div>

      {pendingFile ? (
        <SponsorLogoCropModal
          file={pendingFile}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      ) : null}
    </>
  );
}
