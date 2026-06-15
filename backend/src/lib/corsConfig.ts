import type cors from 'cors';
import { isProductionEnv } from './jwtSecret';
import { isMsdevRuntime } from './msdevGuard';

export function resolveCorsOrigin(): cors.CorsOptions['origin'] {
  const configured = process.env.CORS_ORIGIN?.trim();

  if (isMsdevRuntime()) return '*';

  if (isProductionEnv()) {
    if (!configured) {
      throw new Error(
        '[cors] CORS_ORIGIN must be set in production — refusing to start with origin "*".'
      );
    }
    const origins = configured.split(',').map((o) => o.trim()).filter(Boolean);
    if (origins.length === 0) {
      throw new Error('[cors] CORS_ORIGIN must list at least one origin in production.');
    }
    if (origins.length === 1) return origins[0];
    return origins;
  }

  if (!configured) return '*';
  const origins = configured.split(',').map((o) => o.trim()).filter(Boolean);
  if (origins.length === 0) return '*';
  if (origins.length === 1) return origins[0];
  return origins;
}
