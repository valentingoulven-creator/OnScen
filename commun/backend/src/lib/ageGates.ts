/** Âge minimum pour créer un compte (profil). */
export const MIN_PROFILE_AGE = 13;
export const MAX_PROFILE_AGE = 120;
/** Âge minimum pour lancer un live (contenu artistique). */
export const MIN_LIVE_AGE = 16;
/** Âge minimum pour payer (dons, abonnements) ou recevoir en tant que créateur. */
export const CREATOR_MONETIZATION_MIN_AGE = 18;
/** Âge minimum pour la géolocalisation précise (POST /geo/update, mode « précision max »). */
export const GEO_PRECISE_MIN_AGE = CREATOR_MONETIZATION_MIN_AGE;

export function userMeetsLiveAge(age: number | undefined): boolean {
  return typeof age === 'number' && age >= MIN_LIVE_AGE;
}

export function creatorMeetsMonetizationAge(age: number | undefined): boolean {
  return typeof age === 'number' && age >= CREATOR_MONETIZATION_MIN_AGE;
}

type AgeProfile = { age?: number; birthDate?: string } | null | undefined;

export function userMeetsLiveAgeFromProfile(user: AgeProfile): boolean {
  return userMeetsLiveAge(resolveUserAge(user));
}

export function creatorMeetsMonetizationAgeFromProfile(user: AgeProfile): boolean {
  return creatorMeetsMonetizationAge(resolveUserAge(user));
}

export function userMeetsMonetizationAgeFromProfile(user: AgeProfile): boolean {
  const age = resolveUserAge(user);
  return typeof age === 'number' && age >= CREATOR_MONETIZATION_MIN_AGE;
}

export function userMeetsPreciseGeoAge(age: number | undefined): boolean {
  return typeof age === 'number' && age >= GEO_PRECISE_MIN_AGE;
}

export function userMeetsPreciseGeoAgeFromProfile(user: AgeProfile): boolean {
  return userMeetsPreciseGeoAge(resolveUserAge(user));
}

/**
 * true seulement si l'âge est **connu** et strictement inférieur au seuil.
 * Contrairement à `userMeetsPreciseGeoAgeFromProfile` (qui traite un âge inconnu
 * comme non éligible — fail-closed, adapté aux dons/paiements), cette fonction
 * ne restreint QUE les comptes dont on sait avec certitude qu'ils sont mineurs.
 * Nécessaire pour ne pas dégrader silencieusement la précision géo des comptes
 * historiques n'ayant jamais renseigné leur date de naissance (cf. audit
 * `commun/docs/audit/2026-08-11/03-postgis.md` §3.2 — ~95 % des comptes actifs prod au 2026-08-11).
 */
export function userIsKnownMinorForPreciseGeo(user: AgeProfile): boolean {
  const age = resolveUserAge(user);
  return typeof age === 'number' && age < GEO_PRECISE_MIN_AGE;
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
