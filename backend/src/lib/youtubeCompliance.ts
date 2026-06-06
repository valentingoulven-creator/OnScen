/** Piped / Invidious : secours msdev uniquement — non conforme aux ToS YouTube en production. */
export function isYoutubeRemoteFallbackAllowed(): boolean {
  if (process.env.ALLOW_YOUTUBE_REMOTE_FALLBACK === 'true') return true;
  if (process.env.ALLOW_YOUTUBE_REMOTE_FALLBACK === 'false') return false;
  return process.env.MSENV === 'msdev' || process.env.APP_ENV === 'msdev';
}
