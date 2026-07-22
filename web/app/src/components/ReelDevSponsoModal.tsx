import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MusicReel } from '../content/reels';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { dispatchReelsSponsoRefresh } from '../lib/mapUiEvents';
import {
  buildSponsorPayloadFromAdminForm,
  emptySponsorAdminForm,
  sponsorToAdminForm,
  validateSponsorAdminForm,
  type SponsorAdminFormState,
} from '../lib/sponsorAdminForm';
import { SponsorAdminFormFields } from './SponsorAdminFormFields';

export interface ReelDevSponsoModalProps {
  open: boolean;
  onClose: () => void;
  reel: MusicReel;
}

function buildInitialFormFromReel(reel: MusicReel): SponsorAdminFormState {
  const base = emptySponsorAdminForm('reels_sponsored');
  const title = reel.title.trim() || 'Reel';
  const artist = reel.artist.trim();
  return {
    ...base,
    name: title,
    description: artist ? `${artist} — ${title}` : title,
    videoUrl: reel.videoUrl?.trim() ?? '',
    posterUrl: reel.posterUrl?.trim() ?? '',
    linkUrl: reel.link?.trim() ?? '',
    linkedReelId: reel.id,
  };
}

/** Modale Dev : formulaire sponsor pour le flux Reels sponsorisé. */
export function ReelDevSponsoModal({ open, onClose, reel }: ReelDevSponsoModalProps) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [form, setForm] = useState<SponsorAdminFormState>(() => buildInitialFormFromReel(reel));
  const [existingSponsorId, setExistingSponsorId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadExisting = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setFormError('');
    try {
      const { sponsor } = await api.getDevReelsSponsor(token, reel.id);
      if (sponsor) {
        setForm(sponsorToAdminForm(sponsor));
        setExistingSponsorId(sponsor.id);
      } else {
        setForm(buildInitialFormFromReel(reel));
        setExistingSponsorId(null);
      }
    } catch (e) {
      setForm(buildInitialFormFromReel(reel));
      setExistingSponsorId(null);
      setFormError(e instanceof Error ? e.message : t('reels.sponsoDevError'));
    } finally {
      setLoading(false);
    }
  }, [reel, t, token]);

  useEffect(() => {
    if (!open) return;
    void loadExisting();
  }, [loadExisting, open]);

  useEffect(() => {
    if (open) setFormError('');
  }, [form, open]);

  const handleSubmit = async () => {
    if (!token) {
      setFormError(t('errors.sessionExpired'));
      return;
    }
    const lockedForm = {
      ...form,
      placement: 'reels_sponsored' as const,
      linkedReelId: reel.id,
    };
    const validationError = validateSponsorAdminForm(lockedForm, t);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setBusy(true);
    setFormError('');
    try {
      const payload = {
        ...buildSponsorPayloadFromAdminForm(lockedForm),
        active: true,
      };
      if (existingSponsorId) {
        await api.updateAdminSponsor(token, existingSponsorId, payload);
      } else {
        const res = await api.createAdminSponsor(token, payload);
        setExistingSponsorId(res.sponsor.id);
      }
      dispatchReelsSponsoRefresh();
      onClose();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : t('reels.sponsoDevError'));
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    if (!token || !existingSponsorId) return;
    if (!window.confirm(t('reels.sponsoDevUnconfirm'))) return;
    setBusy(true);
    setFormError('');
    try {
      await api.updateAdminSponsor(token, existingSponsorId, { active: false });
      dispatchReelsSponsoRefresh();
      onClose();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : t('reels.sponsoDevError'));
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-lg max-h-[90dvh] overflow-y-auto overscroll-y-contain rounded-t-2xl sm:rounded-2xl border border-purple-500/30 bg-[#12121a] shadow-[0_0_32px_rgba(168,85,247,0.18)] pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reel-dev-sponso-title"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[#1e1e2f] bg-[#12121a]/95 backdrop-blur-sm px-4 py-3">
          <h2 id="reel-dev-sponso-title" className="text-base font-semibold text-purple-200">
            {t('reels.sponsoDevModalTitle')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-white/10"
            aria-label={t('common.close')}
          >
            ×
          </button>
        </div>

        <div className="p-4">
          {loading ? (
            <p className="text-sm text-gray-400 py-8 text-center">{t('app.loading')}</p>
          ) : (
            <SponsorAdminFormFields
              formId="reel-dev-sponso-form"
              form={{ ...form, placement: 'reels_sponsored', linkedReelId: reel.id }}
              setForm={setForm}
              formError={formError}
              isSubmitBusy={busy}
              submitLabel={
                existingSponsorId ? t('admin.sponsors.save') : t('admin.sponsors.create')
              }
              onSubmit={handleSubmit}
              lockPlacement="reels_sponsored"
              linkedReelIdReadOnly
              secondaryAction={
                existingSponsorId
                  ? {
                      label: t('reels.sponsoDevRemove'),
                      onClick: handleRemove,
                      disabled: busy,
                    }
                  : undefined
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
