/** Aligné sur backend ageGates.ts */
export const MIN_PROFILE_AGE = 13;
export const MAX_PROFILE_AGE = 120;
export const MIN_LIVE_AGE = 16;
export const CREATOR_MONETIZATION_MIN_AGE = 18;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Langues utilisant le format jour/mois/année (Europe). */
const EUROPEAN_LANG_PREFIXES = [
  'fr', 'de', 'es', 'it', 'pt', 'nl', 'pl', 'sv', 'da', 'nb', 'fi', 'cs', 'sk', 'hu', 'ro',
  'bg', 'hr', 'sl', 'lt', 'lv', 'et', 'el', 'ca', 'eu', 'gl', 'is', 'mt', 'lb', 'ga',
];

/** Défaut européen (app FR) ; anglais → MM/DD/YYYY. */
export function usesEuropeanDateFormat(locale?: string): boolean {
  const lang = (locale ?? (typeof navigator !== 'undefined' ? navigator.language : 'fr') ?? 'fr')
    .toLowerCase();
  if (lang.startsWith('en')) return false;
  if (!lang || lang.startsWith('fr')) return true;
  return EUROPEAN_LANG_PREFIXES.some((prefix) => lang.startsWith(prefix));
}

export type BirthDateFields = { day: string; month: string; year: string };

export function isoToBirthDateFields(iso: string): BirthDateFields {
  if (!ISO_DATE_RE.test(iso)) return { day: '', month: '', year: '' };
  const [y, m, d] = iso.split('-');
  return { day: d, month: m, year: y };
}

/** Champs jour/mois/année → ISO YYYY-MM-DD, ou '' si incomplet. */
export function birthDateFieldsToIso(fields: BirthDateFields): string {
  const { day, month, year } = fields;
  if (!day.trim() && !month.trim() && !year.trim()) return '';
  if (!day.trim() || !month.trim() || !year.trim() || year.trim().length !== 4) return '';
  const dayNum = Number(day);
  const monthNum = Number(month);
  const yearNum = Number(year);
  if (!Number.isInteger(dayNum) || !Number.isInteger(monthNum) || !Number.isInteger(yearNum)) {
    return '';
  }
  return `${String(yearNum).padStart(4, '0')}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
}

export function computeAgeFromBirthDate(birthDate: string, refDate = new Date()): number | null {
  if (!ISO_DATE_RE.test(birthDate)) return null;
  const [y, m, d] = birthDate.split('-').map(Number);
  const birth = new Date(y, m - 1, d);
  if (birth.getFullYear() !== y || birth.getMonth() !== m - 1 || birth.getDate() !== d) return null;
  let age = refDate.getFullYear() - birth.getFullYear();
  const monthDiff = refDate.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && refDate.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

/** Retourne une clé d'erreur i18n profile.* ou null si valide / vide. */
export function validateBirthDate(
  birthDate: string
): 'birthDateInvalid' | 'birthDateFuture' | 'underMinAge' | 'overMaxAge' | null {
  const trimmed = birthDate.trim();
  if (!trimmed) return null;
  if (!ISO_DATE_RE.test(trimmed)) return 'birthDateInvalid';
  const [y, m, d] = trimmed.split('-').map(Number);
  const birth = new Date(y, m - 1, d);
  if (birth.getFullYear() !== y || birth.getMonth() !== m - 1 || birth.getDate() !== d) {
    return 'birthDateInvalid';
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (birth > today) return 'birthDateFuture';
  const age = computeAgeFromBirthDate(trimmed);
  if (age == null) return 'birthDateInvalid';
  if (age < MIN_PROFILE_AGE) return 'underMinAge';
  if (age > MAX_PROFILE_AGE) return 'overMaxAge';
  return null;
}

export function birthDateErrorMessage(
  error: NonNullable<ReturnType<typeof validateBirthDate>>
): string {
  switch (error) {
    case 'birthDateInvalid':
      return 'Date de naissance invalide.';
    case 'birthDateFuture':
      return 'La date de naissance ne peut pas être dans le futur.';
    case 'underMinAge':
      return 'Vous devez avoir au moins 13 ans pour utiliser Soundy. La création du compte n’est pas autorisée.';
    case 'overMaxAge':
      return "L'âge doit être entre 13 et 120 ans.";
  }
}

export function todayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Ex. « 15 mars 1990 » (fr) ou « March 15, 1990 » (en). */
export function formatBirthDate(birthDate: string, locale = 'fr-FR'): string | null {
  if (!ISO_DATE_RE.test(birthDate)) return null;
  const [y, m, d] = birthDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  const lang = locale.startsWith('en') ? 'en-US' : 'fr-FR';
  return new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', year: 'numeric' }).format(
    date
  );
}

export function defaultHideBirthDateOnProfile(user: {
  hideBirthDateOnProfile?: boolean;
  showAge?: boolean;
} | null | undefined): boolean {
  if (user?.hideBirthDateOnProfile !== undefined) return user.hideBirthDateOnProfile;
  if (user?.showAge === true) return false;
  return true;
}

export function creatorMeetsMonetizationAge(age: number | undefined): boolean {
  return typeof age === 'number' && age >= CREATOR_MONETIZATION_MIN_AGE;
}
