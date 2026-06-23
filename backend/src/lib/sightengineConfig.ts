function envFlag(name: string, defaultValue = false): boolean {
  const raw = process.env[name];
  if (raw == null || raw === '') return defaultValue;
  const v = raw.trim().toLowerCase();
  if (v === '1' || v === 'true' || v === 'yes' || v === 'on') return true;
  if (v === '0' || v === 'false' || v === 'no' || v === 'off') return false;
  return defaultValue;
}

function envFloat(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function isMsdevRuntime(): boolean {
  return process.env.APP_ENV === 'msdev' || process.env.MSENV === 'msdev';
}

export function isSightengineConfigured(): boolean {
  if (!envFlag('SIGHTENGINE_ENABLED', true)) return false;
  const user = process.env.SIGHTENGINE_API_USER?.trim();
  const secret = process.env.SIGHTENGINE_API_SECRET?.trim();
  return Boolean(user && secret);
}

export function getSightengineCredentials(): { apiUser: string; apiSecret: string } | null {
  if (!isSightengineConfigured()) return null;
  return {
    apiUser: process.env.SIGHTENGINE_API_USER!.trim(),
    apiSecret: process.env.SIGHTENGINE_API_SECRET!.trim(),
  };
}

export function getSightengineModels(): string {
  const raw = process.env.SIGHTENGINE_MODELS?.trim();
  return raw || 'nudity-2.1,offensive-2.0';
}

export function getSightengineApiUrl(): string {
  const raw = process.env.SIGHTENGINE_API_URL?.trim();
  return raw || 'https://api.sightengine.com/1.0/check.json';
}

export function getSightengineVideoApiUrl(): string {
  const raw = process.env.SIGHTENGINE_VIDEO_API_URL?.trim();
  return raw || 'https://api.sightengine.com/1.0/video/check-sync.json';
}

/** Durée max (s) pour l'API vidéo sync Sightengine. */
export function getSightengineVideoSyncMaxSec(): number {
  return envFloat('SIGHTENGINE_VIDEO_SYNC_MAX_SEC', 60);
}

/** Scores ≥ seuil → refus (sexual_activity, sexual_display). */
export function getSightengineExplicitThreshold(): number {
  return envFloat('SIGHTENGINE_EXPLICIT_THRESHOLD', 0.85);
}

/** Scores ≥ seuil → refus (erotica). */
export function getSightengineEroticaThreshold(): number {
  return envFloat('SIGHTENGINE_EROTICA_THRESHOLD', 0.92);
}

/** Scores ≥ seuil → refus (offensive.prob). */
export function getSightengineOffensiveThreshold(): number {
  return envFloat('SIGHTENGINE_OFFENSIVE_THRESHOLD', 0.85);
}

/** Si true, modère aussi les URLs https (pas seulement data:image/). */
export function shouldModerateRemoteImageUrls(): boolean {
  return envFlag('SIGHTENGINE_MODERATE_REMOTE', true);
}

/**
 * En cas d'erreur API : autoriser l'upload (true) ou refuser (false).
 * Par défaut : fail-open en msdev, fail-closed en prod.
 */
export function sightengineFailOpenOnError(): boolean {
  if (process.env.SIGHTENGINE_FAIL_OPEN != null && process.env.SIGHTENGINE_FAIL_OPEN !== '') {
    return envFlag('SIGHTENGINE_FAIL_OPEN', false);
  }
  return isMsdevRuntime();
}

export function getSightengineStatusSummary(): {
  enabled: boolean;
  configured: boolean;
  models: string;
  failOpenOnError: boolean;
  moderateRemoteUrls: boolean;
  explicitThreshold: number;
  eroticaThreshold: number;
  offensiveThreshold: number;
} {
  return {
    enabled: envFlag('SIGHTENGINE_ENABLED', true),
    configured: isSightengineConfigured(),
    models: getSightengineModels(),
    failOpenOnError: sightengineFailOpenOnError(),
    moderateRemoteUrls: shouldModerateRemoteImageUrls(),
    explicitThreshold: getSightengineExplicitThreshold(),
    eroticaThreshold: getSightengineEroticaThreshold(),
    offensiveThreshold: getSightengineOffensiveThreshold(),
  };
}
