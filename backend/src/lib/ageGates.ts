/** Âge minimum pour créer un compte (profil). */
export const MIN_PROFILE_AGE = 13;
export const MAX_PROFILE_AGE = 120;
/** Âge minimum pour lancer un live (contenu artistique). */
export const MIN_LIVE_AGE = 16;
/** Âge minimum pour payer (dons, abonnements) ou recevoir en tant que créateur. */
export const CREATOR_MONETIZATION_MIN_AGE = 18;

export function userMeetsLiveAge(age: number | undefined): boolean {
  return typeof age === 'number' && age >= MIN_LIVE_AGE;
}

export function creatorMeetsMonetizationAge(age: number | undefined): boolean {
  return typeof age === 'number' && age >= CREATOR_MONETIZATION_MIN_AGE;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Âge dérivé de birthDate (AAAA-MM-JJ) si présent, sinon champ age stocké. */
export function resolveUserAge(
  user: { age?: number; birthDate?: string } | null | undefined,
  refDate = new Date()
): number | undefined {
  if (!user) return undefined;
  const birthDate = user.birthDate?.trim();
  if (birthDate && ISO_DATE_RE.test(birthDate)) {
    const [y, m, d] = birthDate.split('-').map(Number);
    const birth = new Date(y, m - 1, d);
    if (birth.getFullYear() === y && birth.getMonth() === m - 1 && birth.getDate() === d) {
      let age = refDate.getFullYear() - birth.getFullYear();
      const monthDiff = refDate.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && refDate.getDate() < birth.getDate())) {
        age -= 1;
      }
      return age;
    }
  }
  if (typeof user.age === 'number') return user.age;
  return undefined;
}
