/** Erreurs navigateur fréquentes / non actionnables — ne pas envoyer à Sentry. */
const IGNORED_ERROR_PATTERNS = [
  /ResizeObserver loop/i,
  /Loading chunk \d+ failed/i,
  /Failed to fetch dynamically imported module/i,
  /NetworkError when attempting to fetch resource/i,
  /AbortError/i,
  /Non-Error promise rejection captured/i,
  /Extension context invalidated/i,
];

export function shouldIgnoreSentryEvent(message: string): boolean {
  return IGNORED_ERROR_PATTERNS.some((re) => re.test(message));
}
