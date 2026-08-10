import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';

interface LiveLegalAcceptanceModalProps {
  token: string;
  onAccepted: (acceptedAt: number) => void;
  onClose: () => void;
}

/**
 * Gate 2 — Acceptation des règles de diffusion OnScen.
 * Affiché uniquement avant le PREMIER live (liveTermsAcceptedAt absent du profil).
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
      className="fixed inset-0 z-[60] flex items-center justify-center ms-modal-overlay bg-black/75 backdrop-blur-sm overflow-hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="live-legal-title"
        className="w-full max-w-[min(100%,28rem)] sm:max-w-md bg-[#0f0f1a] border border-[#2a2a3f] rounded-2xl shadow-2xl flex flex-col min-h-0 overflow-hidden max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-1rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 border-b border-[#1e1e2f] px-3 sm:px-4 pt-2.5 sm:pt-3 pb-2 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-red-600/20 border border-red-500/30 flex items-center justify-center shrink-0">
              <span className="text-sm" aria-hidden>
                📋
              </span>
            </div>
            <div className="min-w-0">
              <h2 id="live-legal-title" className="text-xs sm:text-sm font-bold text-white leading-snug">
                {t('live.legalTitle')}
              </h2>
              <p className="text-[10px] text-gray-400 mt-0.5 leading-snug line-clamp-2 sm:line-clamp-none">
                {t('live.legalSubtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full text-gray-500 hover:text-white hover:bg-white/5 transition text-lg leading-none"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        {/* Corps — tout visible, sans scroll interne */}
        <div className="shrink-0 px-3 sm:px-4 py-2 sm:py-3 space-y-2">
          <div className="grid grid-cols-1 min-[22rem]:grid-cols-2 gap-2 sm:gap-3">
            <section>
              <h3 className="text-[10px] font-bold text-red-400 uppercase tracking-wide mb-1">
                {t('live.legalContentTitle')}
              </h3>
              <ul className="space-y-1">
                {[
                  t('live.legalContentRule1'),
                  t('live.legalContentRule2'),
                  t('live.legalContentRule3'),
                  t('live.legalContentRule4'),
                ].map((rule) => (
                  <li key={rule} className="flex items-start gap-1.5 text-[11px] sm:text-xs text-gray-300 leading-snug">
                    <span className="shrink-0 text-red-500 font-bold" aria-hidden>
                      •
                    </span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="text-[10px] font-bold text-amber-400 uppercase tracking-wide mb-1">
                {t('live.legalMonetTitle')}
              </h3>
              <ul className="space-y-1">
                {[
                  t('live.legalMonetRule1'),
                  t('live.legalMonetRule2'),
                  t('live.legalMonetRule3'),
                  t('live.legalMonetRule4'),
                ].map((rule) => (
                  <li key={rule} className="flex items-start gap-1.5 text-[11px] sm:text-xs text-gray-300 leading-snug">
                    <span className="shrink-0 text-amber-500 font-bold" aria-hidden>
                      •
                    </span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <div className="rounded-lg bg-amber-500/8 border border-amber-500/20 px-2.5 py-2 flex items-start gap-2">
            <span className="text-base shrink-0 leading-none" aria-hidden>
              💰
            </span>
            <p className="text-[11px] sm:text-xs text-amber-200/80 leading-snug">
              <span className="font-bold">Commission OnScen 50 %</span> — vous recevez{' '}
              <span className="font-bold text-amber-300">50 %</span> de chaque pourboire sur votre compte
              Stripe.
            </p>
          </div>
        </div>

        {/* Pied fixe — case + CTA */}
        <div className="shrink-0 border-t border-[#1e1e2f] bg-[#0f0f1a] px-3 sm:px-4 py-2.5 sm:py-3 space-y-2">
          <label className="flex items-start gap-2.5 cursor-pointer group min-h-[44px]">
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
                  <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none" aria-hidden>
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
            <span className="text-[11px] sm:text-xs text-gray-300 leading-snug">{t('live.legalCheckbox')}</span>
          </label>

          {error && <p className="text-[11px] text-red-400">{error}</p>}

          <button
            type="button"
            onClick={() => void handleAccept()}
            disabled={!checked || accepting}
            className="w-full min-h-[44px] py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition active:scale-[0.98]"
          >
            {accepting ? t('live.legalAccepting') : t('live.legalAcceptCta')}
          </button>
        </div>
      </div>
    </div>
  );
}
