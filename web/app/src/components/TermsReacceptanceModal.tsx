import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LegalDocumentView } from './LegalDocumentView';
import { CURRENT_TERMS_VERSION, type LegalKey } from '../content/legal';
import { api } from '../lib/api';

interface TermsReacceptanceModalProps {
  token: string;
  onAccepted: () => void;
  onLogout: () => void;
}

export function TermsReacceptanceModal({ token, onAccepted, onLogout }: TermsReacceptanceModalProps) {
  const { t } = useTranslation();
  const [legalPreview, setLegalPreview] = useState<LegalKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (legalPreview) {
    return <LegalDocumentView docKey={legalPreview} onBack={() => setLegalPreview(null)} />;
  }

  return (
    <div className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center ms-modal-overlay bg-black/70">
      <div
        className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-[#2d2d3d] bg-[#12121a] p-5 shadow-xl space-y-4 pb-[env(safe-area-inset-bottom)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-reaccept-title"
      >
        <h2 id="terms-reaccept-title" className="text-base font-semibold text-white">
          {t('legal.termsUpdatedTitle', 'Conditions mises à jour')}
        </h2>
        <p className="text-sm text-gray-400 leading-relaxed">
          {t(
            'legal.termsUpdatedBody',
            'Nos conditions d’utilisation ont évolué. Acceptez-les pour continuer à utiliser OnScen.'
          )}{' '}
          <span className="text-gray-500">(v.{CURRENT_TERMS_VERSION})</span>
        </p>
        <p className="text-xs text-gray-500">
          {t('auth.acceptTermsPrefix')}{' '}
          <button type="button" onClick={() => setLegalPreview('terms')} className="text-purple-400 underline">
            {t('auth.termsLink', 'CGU')}
          </button>{' '}
          {t('auth.acceptTermsAnd')}{' '}
          <button type="button" onClick={() => setLegalPreview('privacy')} className="text-purple-400 underline">
            {t('auth.privacyLink', 'Politique de confidentialité')}
          </button>
        </p>
        {error ? <p className="text-xs text-red-400">{error}</p> : null}
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={onLogout}
            className="flex-1 min-h-[44px] rounded-xl border border-[#2d2d3d] text-sm text-gray-300 hover:bg-[#1a1a26]"
          >
            {t('auth.logout', 'Se déconnecter')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await api.acceptTerms(token, CURRENT_TERMS_VERSION);
                onAccepted();
              } catch (e) {
                setError(e instanceof Error ? e.message : t('legal.termsAcceptError', 'Erreur'));
              } finally {
                setBusy(false);
              }
            }}
            className="flex-1 min-h-[44px] rounded-xl bg-purple-600 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50"
          >
            {busy ? t('common.loading', 'Chargement…') : t('legal.acceptTermsContinue', 'Accepter et continuer')}
          </button>
        </div>
      </div>
    </div>
  );
}
