import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';

interface LiveLegalAcceptanceModalProps {
  token: string;
  onAccepted: (acceptedAt: number) => void;
  onClose: () => void;
}

/**
 * Gate 2 — Acceptation des règles de diffusion Soundy.
 * Affiché uniquement avant le PREMIER live (liveTermsAcceptedAt absent du profil).
 * Règles :
 *  - Contenu : violence, nudité, droits d'auteur, respect
 *  - Monétisation : commission 30 % sur les pourboires
 * Après acceptation → PATCH /api/users/me/live-terms → timestamp enregistré en base.
 */
export function LiveLegalAcceptanceModal({ token, onAccepted, onClose }: LiveLegalAcceptanceModalProps) {
  const { t } = useTranslation();
  const [checked, setChecked] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async () => {
    if (!checked) return;
    setAccepting(true);
    setError(null);
    try {
      const { liveTermsAcceptedAt } = await api.acceptLiveTerms(token);
      onAccepted(liveTermsAcceptedAt);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de l'enregistrement");
      setAccepting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="live-legal-title"
        className="w-full max-w-md bg-[#0f0f1a] border border-[#2a2a3f] rounded-2xl shadow-2xl overflow-y-auto max-h-[90dvh]"
      >
        {/* Header */}
        <div className="sticky top-0 bg-[#0f0f1a] border-b border-[#1e1e2f] px-5 pt-5 pb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center shrink-0">
              <span className="text-base">📋</span>
            </div>
            <div>
              <h2 id="live-legal-title" className="text-sm font-bold text-white">{t('live.legalTitle')}</h2>
              <p className="text-[10px] text-gray-400 mt-0.5">{t('live.legalSubtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-gray-500 hover:text-white text-xl leading-none mt-0.5"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Content rules */}
          <section>
            <h3 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2.5">
              {t('live.legalContentTitle')}
            </h3>
            <ul className="space-y-2">
              {[
                t('live.legalContentRule1'),
                t('live.legalContentRule2'),
                t('live.legalContentRule3'),
                t('live.legalContentRule4'),
              ].map((rule) => (
                <li key={rule} className="flex items-start gap-2.5 text-xs text-gray-300">
                  <span className="mt-0.5 shrink-0 text-red-500 font-bold">•</span>
                  {rule}
                </li>
              ))}
            </ul>
          </section>

          {/* Monetisation rules */}
          <section>
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2.5">
              {t('live.legalMonetTitle')}
            </h3>
            <ul className="space-y-2">
              {[
                t('live.legalMonetRule1'),
                t('live.legalMonetRule2'),
                t('live.legalMonetRule3'),
                t('live.legalMonetRule4'),
              ].map((rule) => (
                <li key={rule} className="flex items-start gap-2.5 text-xs text-gray-300">
                  <span className="mt-0.5 shrink-0 text-amber-500 font-bold">•</span>
                  {rule}
                </li>
              ))}
            </ul>
          </section>

          {/* Commission callout */}
          <div className="rounded-xl bg-amber-500/8 border border-amber-500/20 px-4 py-3 flex items-center gap-3">
            <span className="text-xl shrink-0">💰</span>
            <p className="text-xs text-amber-200/80">
              <span className="font-bold">Commission Soundy 30 %</span> — vous recevez{' '}
              <span className="font-bold text-amber-300">70 %</span> de chaque pourboire
              directement sur votre compte Stripe.
            </p>
          </div>

          {/* Mandatory checkbox */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative mt-0.5 shrink-0">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                className="sr-only"
              />
              <div
                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${
                  checked
                    ? 'bg-red-600 border-red-500'
                    : 'border-[#3a3a55] bg-[#1a1a26] group-hover:border-red-500/50'
                }`}
              >
                {checked && (
                  <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M2 6l3 3 5-5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
            </div>
            <span className="text-xs text-gray-300 leading-relaxed">{t('live.legalCheckbox')}</span>
          </label>

          {error && <p className="text-xs text-red-400">{error}</p>}

          {/* Accept button */}
          <button
            type="button"
            onClick={() => void handleAccept()}
            disabled={!checked || accepting}
            className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {accepting ? t('live.legalAccepting') : t('live.legalAcceptCta')}
          </button>
        </div>
      </div>
    </div>
  );
}
