export const BRAND_NAME = 'Soundy';

export const DEFAULT_PLAYBACK_SESSION_TITLE = `${BRAND_NAME} Session`;

/** Remplace l'ancien nom « Soundly » (legacy) par Soundy. */
export function normalizeBrandText(text: string): string {
  return text.replace(/Soundly/g, BRAND_NAME);
}
