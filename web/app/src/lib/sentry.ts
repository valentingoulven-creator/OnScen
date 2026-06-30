import * as Sentry from '@sentry/react';

import { shouldIgnoreSentryEvent } from './sentryFilters';



let active = false;



export function initSentry(): void {

  const dsn = import.meta.env.VITE_SENTRY_DSN?.trim();

  if (!dsn) return;

  if (import.meta.env.VITE_APP_ENV === 'msdev' || import.meta.env.DEV) return;



  const release = import.meta.env.VITE_SENTRY_RELEASE?.trim();



  Sentry.init({

    dsn,

    environment: import.meta.env.VITE_APP_ENV || 'production',

    ...(release ? { release } : {}),

    integrations: [

      Sentry.browserTracingIntegration(),

      Sentry.replayIntegration({

        maskAllText: true,

        blockAllMedia: true,

      }),

    ],

    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? '0.05'),

    replaysSessionSampleRate: Number(import.meta.env.VITE_SENTRY_REPLAY_SAMPLE_RATE ?? '0'),

    replaysOnErrorSampleRate: Number(import.meta.env.VITE_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE ?? '1'),

    sendDefaultPii: false,

    beforeSend(event) {

      const message = event.exception?.values?.[0]?.value ?? event.message ?? '';

      if (typeof message === 'string' && shouldIgnoreSentryEvent(message)) {

        return null;

      }

      return event;

    },

  });

  active = true;

}



export function captureClientError(error: unknown, context?: Record<string, unknown>): void {

  if (!active) return;

  Sentry.withScope((scope) => {

    if (context) scope.setContext('extra', context);

    Sentry.captureException(error);

  });

}



export function isSentryClientActive(): boolean {

  return active;

}

