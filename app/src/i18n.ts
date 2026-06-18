import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import fr from './locales/fr.json';
import en from './locales/en.json';
import { getAppLanguage } from './lib/settings';
import { applyDocumentMeta } from './lib/documentMeta';

const initialLang = getAppLanguage();

void i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
  },
  lng: initialLang,
  fallbackLng: 'fr',
  interpolation: { escapeValue: false },
});

document.documentElement.lang = initialLang;
applyDocumentMeta(initialLang);

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng.startsWith('en') ? 'en' : 'fr';
  applyDocumentMeta(lng);
});

export default i18n;
