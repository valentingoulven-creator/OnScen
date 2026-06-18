export type AppLocale = 'fr' | 'en';

/** Parse Accept-Language (first tag only). Defaults to French. */
export function parseRequestLocale(acceptLanguage?: string | string[]): AppLocale {
  const raw = Array.isArray(acceptLanguage) ? acceptLanguage[0] : acceptLanguage;
  if (!raw || typeof raw !== 'string') return 'fr';
  const tag = raw.split(',')[0]?.trim().toLowerCase() ?? '';
  return tag.startsWith('en') ? 'en' : 'fr';
}

const GEO_ERRORS: Record<AppLocale, Record<string, string>> = {
  fr: {
    invalidCoords: 'Coordonnées invalides',
    coordsRequired: 'latitude et longitude requis',
    geocodeMin: 'Paramètre q requis (min. 2 caractères)',
    geocodeUnavailable: 'Géocodage indisponible',
    geocodeRateLimit: 'Trop de requêtes de géocodage. Réessayez plus tard.',
    gouvUnavailable: 'geo.api.gouv.fr indisponible',
  },
  en: {
    invalidCoords: 'Invalid coordinates',
    coordsRequired: 'latitude and longitude required',
    geocodeMin: 'Parameter q required (min. 2 characters)',
    geocodeUnavailable: 'Geocoding unavailable',
    geocodeRateLimit: 'Too many geocoding requests. Try again later.',
    gouvUnavailable: 'geo.api.gouv.fr unavailable',
  },
};

export function geoError(key: keyof typeof GEO_ERRORS.fr, locale: AppLocale): string {
  return GEO_ERRORS[locale][key] ?? GEO_ERRORS.fr[key];
}
