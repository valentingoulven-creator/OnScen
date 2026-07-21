import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { splitFeedEventContent } from '../lib/feedEvents';
import { api } from '../lib/api';
import { dispatchMapSidebarSponsoRefresh } from '../lib/mapUiEvents';
import {
  buildSponsorPayloadFromAdminForm,
  emptySponsorAdminForm,
  sponsorToAdminForm,
  validateSponsorAdminForm,
  type SponsorAdminFormState,
} from '../lib/sponsorAdminForm';
import type { FeedPost } from '../types';
import { SponsorAdminFormFields } from './SponsorAdminFormFields';

export interface EventDevSponsoModalProps {
  open: boolean;
  onClose: () => void;
  post: FeedPost;
}

function buildInitialFormFromPost(post: FeedPost): SponsorAdminFormState {
  const { title } = splitFeedEventContent(post.content);
  const name = title.trim() || post.content.trim().split('\n')[0]?.trim() || post.eventLocation?.trim() || 'Événement';
  return {
    ...emptySponsorAdminForm('map_sidebar_events'),
    name,
    linkedEventPostId: post.id,
    linkUrl: post.eventLinkUrl?.trim() ?? '',
  };
}

/** Modale Dev : formulaire sponsor (durée, dates…) pour le carrousel Sponso sidebar carte. */
export function EventDevSponsoModal({ open, onClose, post }: EventDevSponsoModalProps) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [form, setForm] = useState<SponsorAdminFormState>(() => buildInitialFormFromPost(post));
  const [existingSponsorId, setExistingSponsorId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadExisting = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setFormError('');
    try {
      const { sponsor } = await api.getDevMapSidebarEventSponsor(token, post.id);
      if (sponsor) {
        setForm(sponsorToAdminForm(sponsor));
        setExistingSponsorId(sponsor.id);
      } else {
        setForm(buildInitialFormFromPost(post));
        setExistingSponsorId(null);
      }
    } catch (e) {
      setForm(buildInitialFormFromPost(post));
      setExistingSponsorId(null);
      setFormError(e instanceof Error ? e.message : t('feed.eventSponsoDevError'));
    } finally {
      setLoading(false);
    }
  }, [post, t, token]);

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
    const validationError = validateSponsorAdminForm(
      { ...form, placement: 'map_sidebar_events', linkedEventPostId: post.id },
      t
    );
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setBusy(true);
    setFormError('');
    try {
      const payload = {
        ...buildSponsorPayloadFromAdminForm({
          ...form,
          placement: 'map_sidebar_events',
          linkedEventPostId: post.id,
        }),
        active: true,
      };
      if (existingSponsorId) {
        await api.updateAdminSponsor(token, existingSponsorId, payload);
      } else {
        const res = await api.createAdminSponsor(token, payload);
        setExistingSponsorId(res.sponsor.id);
      }
      dispatchMapSidebarSponsoRefresh();
      onClose();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : t('feed.eventSponsoDevError'));
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    if (!token || !existingSponsorId) return;
    if (!window.confirm(t('feed.eventSponsoDevUnconfirm'))) return;
    setBusy(true);
    setFormError('');
    try {
      await api.updateAdminSponsor(token, existingSponsorId, { active: false });
      dispatchMapSidebarSponsoRefresh();
      onClose();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : t('feed.eventSponsoDevError'));
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
        aria-labelledby="event-dev-sponso-title"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[#1e1e2f] bg-[#12121a]/95 backdrop-blur-sm px-4 py-3">
          <h2 id="event-dev-sponso-title" className="text-base font-semibold text-purple-200">
            {t('feed.eventSponsoDevModalTitle')}
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
              formId="event-dev-sponso-form"
              form={{ ...form, placement: 'map_sidebar_events', linkedEventPostId: post.id }}
              setForm={setForm}
              formError={formError}
              isSubmitBusy={busy}
              submitLabel={
                existingSponsorId ? t('admin.sponsors.save') : t('admin.sponsors.create')
              }
              onSubmit={handleSubmit}
              lockPlacement="map_sidebar_events"
              linkedEventPostIdReadOnly
              secondaryAction={
                existingSponsorId
                  ? {
                      label: t('feed.eventSponsoDevRemove'),
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
