/**
 * Piped / Invidious : fallback msdev uniquement — non conforme aux ToS YouTube.
 *
 * Règle de sécurité : En production (APP_ENV=production ou NODE_ENV=production),
 * les proxies Piped/Invidious sont TOUJOURS désactivés, quelle que soit la valeur
 * de ALLOW_YOUTUBE_REMOTE_FALLBACK. Un env var mal positionné en production ne
 * doit pas suffire à activer une fonctionnalité contraire aux ToS YouTube.
 *
 * Ces proxies ne doivent tourner QUE en environnement msdev local (développement/test).
 */
export function isYoutubeRemoteFallbackAllowed(): boolean {
  const isProduction =
    process.env.NODE_ENV === 'production' ||
    process.env.APP_ENV === 'production';

  if (isProduction) {
    if (process.env.ALLOW_YOUTUBE_REMOTE_FALLBACK === 'true') {
      console.warn(
        '[youtubeCompliance] ALLOW_YOUTUBE_REMOTE_FALLBACK=true ignoré en production — ' +
        'Piped/Invidious sont non conformes aux ToS YouTube et désactivés de force.',
      );
    }
    return false;
  }

  if (process.env.ALLOW_YOUTUBE_REMOTE_FALLBACK === 'true') return true;
  if (process.env.ALLOW_YOUTUBE_REMOTE_FALLBACK === 'false') return false;
  return process.env.MSENV === 'msdev' || process.env.APP_ENV === 'msdev';
}
