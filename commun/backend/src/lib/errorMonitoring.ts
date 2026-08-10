import type { Express } from 'express';

import { isDeployedEnv } from './jwtSecret';

import { resolveBackendSentryRelease } from './sentryRelease';



type SentryNode = typeof import('@sentry/node');



let sentry: SentryNode | null = null;



const IGNORED_ERROR_PATTERNS = [

  /ECONNRESET/i,

  /EPIPE/i,

  /socket hang up/i,

  /AbortError/i,

];



function shouldIgnoreSentryError(error: unknown): boolean {

  const message = error instanceof Error ? error.message : String(error ?? '');

  return IGNORED_ERROR_PATTERNS.some((re) => re.test(message));

}

const SENSITIVE_KEY_RE = /password|authorization|cookie|token|secret|api[_-]?key/i;

function scrubSentryEvent<T extends { request?: { headers?: Record<string, string> }; extra?: Record<string, unknown> }>(
  event: T
): T {
  if (event.request?.headers) {
    for (const key of Object.keys(event.request.headers)) {
      if (SENSITIVE_KEY_RE.test(key)) {
        event.request.headers[key] = '[Filtered]';
      }
    }
  }
  return event;
}



export function isSentryActive(): boolean {

  return sentry != null;

}



/**

 * Monitoring erreurs — active Sentry si SENTRY_DSN est défini.

 * Ignoré en msdev local.

 */

export async function initErrorMonitoring(): Promise<void> {

  const dsn = process.env.SENTRY_DSN?.trim();

  if (!dsn) return;

  if (process.env.APP_ENV === 'msdev' || process.env.MSENV === 'msdev') return;



  try {

    sentry = await import('@sentry/node');

    sentry.init({

      dsn,

      environment: process.env.APP_ENV || 'production',

      release: resolveBackendSentryRelease(),

      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.05'),

      sendDefaultPii: false,

      integrations: [sentry.httpIntegration(), sentry.expressIntegration()],

      beforeSend(event, hint) {

        const original = hint.originalException;

        if (shouldIgnoreSentryError(original)) return null;

        const message = event.exception?.values?.[0]?.value ?? event.message ?? '';

        if (typeof message === 'string' && shouldIgnoreSentryError(message)) {

          return null;

        }

        return scrubSentryEvent(event);

      },

    });

    console.log('[monitoring] Sentry actif — release', resolveBackendSentryRelease());

  } catch (err) {

    console.warn('[monitoring] SENTRY_DSN défini mais @sentry/node indisponible:', err);

    sentry = null;

  }

}



/** Handler d'erreurs Express Sentry — appeler après toutes les routes. */

export function setupSentryExpressErrorHandler(app: Express): void {

  if (!sentry) return;

  sentry.setupExpressErrorHandler(app);

}



export function captureError(error: unknown, context?: Record<string, unknown>): void {

  if (!sentry || shouldIgnoreSentryError(error)) return;

  sentry.withScope((scope) => {

    if (context) scope.setContext('extra', context);

    sentry!.captureException(error);

  });

}



export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {

  if (!sentry) return;

  sentry.captureMessage(message, level);

}



/** Log console en dev + Sentry en prod déployée. */

export function reportServerError(error: unknown, context?: Record<string, unknown>): void {

  if (!isDeployedEnv()) {

    console.error('[server]', error, context ?? '');

  }

  captureError(error, context);

}

