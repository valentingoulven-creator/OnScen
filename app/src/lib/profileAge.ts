/** Aligné sur backend ageGates.ts */
export const MIN_PROFILE_AGE = 13;
export const MAX_PROFILE_AGE = 120;
export const MIN_LIVE_AGE = 16;
export const CREATOR_MONETIZATION_MIN_AGE = 18;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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
export function validateBirthDate(birthDate: string): 'birthDateInvalid' | 'birthDateFuture' | 'ageRangeError' | null {
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
  if (age == null || age < MIN_PROFILE_AGE || age > MAX_PROFILE_AGE) return 'ageRangeError';
  return null;
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
