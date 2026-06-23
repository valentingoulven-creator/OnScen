import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getCookieConsent, setCookieConsent } from '../lib/cookieConsent';
import { isNativeApp } from '../lib/nativePlatform';
import { LegalDocumentView } from './LegalDocumentView';

export function CookieConsentBanner() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(() => !isNativeApp() && getCookieConsent() == null);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  useEffect(() => {
    if (isNativeApp()) {
      setVisible(false);
      return;
    }
    if (getCookieConsent() != null) setVisible(false);
  }, []);

  if (isNativeApp()) return null;

  if (privacyOpen) {
    return (
      <LegalDocumentView docKey="privacy" onBack={() => setPrivacyOpen(false)} />
    );
  }

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[120] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      role="dialog"
      aria-labelledby="cookie-consent-title"
      aria-live="polite"
    >
      <div className="mx-auto w-full max-w-lg rounded-2xl border border-[#2d2d3d] bg-[#12121a]/95 backdrop-blur-md p-4 shadow-xl space-y-3">
        <p id="cookie-consent-title" className="text-sm font-semibold text-white">
          {t('cookies.bannerTitle', 'Cookies et services tiers')}
        </p>
        <p className="text-xs text-gray-400 leading-relaxed">
          {t(
            'cookies.bannerBody',
            'Soundy utilise des cookies essentiels pour la connexion et, avec votre accord, charge Stripe (paiements) et YouTube (lecteur intégré).'
          )}{' '}
          <button
            type="button"
            onClick={() => setPrivacyOpen(true)}
            className="text-purple-400 hover:text-purple-300 underline underline-offset-2"
          >
            {t('cookies.privacyLink', 'Politique de confidentialité')}
          </button>
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => {
              setCookieConsent('essential');
              setVisible(false);
            }}
            className="flex-1 min-h-[44px] rounded-xl border border-[#2d2d3d] text-sm font-medium text-gray-300 hover:bg-[#1a1a26]"
          >
            {t('cookies.essentialOnly', 'Essentiels uniquement')}
          </button>
          <button
            type="button"
            onClick={() => {
              setCookieConsent('all');
              setVisible(false);
            }}
            className="flex-1 min-h-[44px] rounded-xl bg-purple-600 text-sm font-semibold text-white hover:bg-purple-500"
          >
            {t('cookies.acceptAll', 'Tout accepter')}
          </button>
        </div>
      </div>
    </div>
  );
}
