/**
 * Monitoring erreurs optionnel — active Sentry si SENTRY_DSN est défini et @sentry/node installé.
 */
export async function initErrorMonitoring(): Promise<void> {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return;
  if (process.env.APP_ENV === 'msdev' || process.env.MSENV === 'msdev') return;

  try {
    const sentryModule = '@sentry/node';
    const Sentry = await import(/* webpackIgnore: true */ sentryModule);
    Sentry.init({
      dsn,
      environment: process.env.APP_ENV || 'production',
      tracesSampleRate: 0.05,
    });
    console.log('[monitoring] Sentry actif');
  } catch {
    console.warn(
      '[monitoring] SENTRY_DSN défini mais @sentry/node absent — npm install @sentry/node dans backend/'
    );
  }
}
