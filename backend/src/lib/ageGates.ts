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
