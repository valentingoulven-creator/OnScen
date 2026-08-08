/** SEO / Open Graph meta synced with i18n language. */

const META = {
  fr: {
    title: "OnScen — Salons d'écoute musicale géolocalisés",
    description:
      "Rejoignez des salons d'écoute musicale en direct, découvrez des lives et connectez-vous avec des mélomanes près de vous.",
    ogLocale: 'fr_FR',
    keywords: 'salon musique, écoute collective, live musical, YouTube, géolocalisé, OnScen',
    twitterDescription: "Salons d'écoute musicale géolocalisés — YouTube",
  },
  en: {
    title: 'OnScen — Geo-located music listening rooms',
    description:
      'Join live music listening rooms, discover streams and connect with music lovers near you.',
    ogLocale: 'en_US',
    keywords: 'music room, collective listening, live music, YouTube, geo-located, OnScen',
    twitterDescription: 'Geo-located music listening rooms — YouTube',
  },
} as const;

type MetaLang = keyof typeof META;

function resolveLang(lng: string): MetaLang {
  return lng.startsWith('en') ? 'en' : 'fr';
}

function setMeta(name: string, content: string, property = false): void {
  const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`;
  let el = document.querySelector(selector);
  if (!el) {
    el = document.createElement('meta');
    if (property) el.setAttribute('property', name);
    else el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/** Update document title and OG/Twitter tags for the active language. */
export function applyDocumentMeta(lng: string): void {
  if (typeof document === 'undefined') return;
  const lang = resolveLang(lng);
  const m = META[lang];
  document.documentElement.lang = lang;
  document.title = m.title;
  setMeta('description', m.description);
  setMeta('keywords', m.keywords);
  setMeta('og:title', m.title, true);
  setMeta('og:description', m.description, true);
  setMeta('og:locale', m.ogLocale, true);
  setMeta('twitter:title', m.title);
  setMeta('twitter:description', m.twitterDescription);
}
