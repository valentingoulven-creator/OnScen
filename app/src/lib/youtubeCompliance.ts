/** Mode strict : conformité YouTube en production (pas de lecture audio sans vidéo visible). */
export function isYoutubeStrictCompliance(): boolean {
  return import.meta.env.VITE_APP_ENV !== 'msdev';
}
