import { isMsdevRuntime } from './msdevGuard';

function parseOrigins(envValue: string | undefined): string[] {
  if (!envValue?.trim()) return [];
  return envValue.split(',').map((o) => o.trim()).filter(Boolean);
}

function liveKitHttpOrigin(): string | null {
  const url = process.env.LIVEKIT_URL?.trim();
  if (!url) return null;
  try {
    const parsed = new URL(url.replace(/^wss:/i, 'https:').replace(/^ws:/i, 'http:'));
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

/** CSP connect-src — known API / realtime endpoints only (no blanket https:). */
export function buildCspConnectSrc(): string[] {
  const origins = new Set<string>(["'self'"]);

  for (const origin of parseOrigins(process.env.CORS_ORIGIN)) {
    origins.add(origin);
    try {
      const u = new URL(origin);
      if (u.protocol === 'https:') origins.add(`wss://${u.host}`);
      if (u.protocol === 'http:') origins.add(`ws://${u.host}`);
    } catch {
      /* ignore malformed */
    }
  }

  const lk = liveKitHttpOrigin();
  if (lk) {
    origins.add(lk);
    origins.add(lk.replace(/^https:/i, 'wss:'));
  }

  origins.add('https://api.stripe.com');
  origins.add('https://m.stripe.com');
  origins.add('https://m.stripe.network');
  origins.add('https://www.googleapis.com');
  origins.add('https://oauth2.googleapis.com');
  origins.add('https://accounts.google.com');
  origins.add('https://*.ingest.de.sentry.io');
  origins.add('https://*.ingest.sentry.io');
  origins.add('https://*.cloudflarestream.com');
  origins.add('https://customer-*.cloudflarestream.com');
  origins.add('https://upload.cloudflarestream.com');
  origins.add('https://api.qrserver.com');

  if (isMsdevRuntime()) {
    origins.add('http://localhost:5173');
    origins.add('http://127.0.0.1:5173');
    origins.add('ws://localhost:5173');
    origins.add('ws://127.0.0.1:5173');
    origins.add('http://localhost:4080');
    origins.add('ws://localhost:4080');
  }

  return [...origins];
}

/** CSP img-src — https only in deployed stacks. */
export function buildCspImgSrc(): string[] {
  const src = ["'self'", 'data:', 'blob:', 'https:'];
  if (isMsdevRuntime()) src.push('http:');
  return src;
}
