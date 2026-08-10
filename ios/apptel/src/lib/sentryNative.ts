import * as Sentry from '@sentry/react';

let active = false;

/** Sentry sur builds Capacitor natifs (sans bandeau cookies — erreurs app uniquement). */
export function initNativeSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN?.trim();
  if (!dsn || import.meta.env.VITE_APP_ENV === 'msdev' || import.meta.env.DEV) return;
  if (active) return;
  const release = import.meta.env.VITE_SENTRY_RELEASE?.trim();
  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_APP_ENV || 'production',
    ...(release ? { release } : {}),
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? '0.05'),
    sendDefaultPii: false,
  });
  active = true;
}

export function captureNativeClientError(error: unknown, context?: Record<string, unknown>): void {
  if (!active) return;
  Sentry.withScope((scope: Sentry.Scope) => {
    if (context) scope.setContext('extra', context);
    Sentry.captureException(error);
  });
}
