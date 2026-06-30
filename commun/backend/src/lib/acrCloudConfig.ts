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

export function isAcrCloudEnabled(): boolean {
  return envFlag('ACRCLOUD_ENABLED', true);
}

export function isAcrCloudConfigured(): boolean {
  if (!isAcrCloudEnabled()) return false;
  const key = process.env.ACRCLOUD_ACCESS_KEY?.trim();
  const secret = process.env.ACRCLOUD_ACCESS_SECRET?.trim();
  return Boolean(key && secret);
}

export function getAcrCloudCredentials(): { accessKey: string; accessSecret: string } | null {
  if (!isAcrCloudConfigured()) return null;
  return {
    accessKey: process.env.ACRCLOUD_ACCESS_KEY!.trim(),
    accessSecret: process.env.ACRCLOUD_ACCESS_SECRET!.trim(),
  };
}

/** Host ACRCloud (EU recommandé pour RGPD). */
export function getAcrCloudHost(): string {
  const raw = process.env.ACRCLOUD_HOST?.trim();
  return raw || 'https://identify-eu-west-1.acrcloud.com';
}

/** Score ACRCloud ≥ seuil → morceau catalogue commercial identifié. */
export function getAcrCloudMatchScoreThreshold(): number {
  return envFloat('ACRCLOUD_MATCH_SCORE_THRESHOLD', 80);
}

/** Taille max de l'échantillon envoyé (ACRCloud : 5 Mo). */
export function getAcrCloudMaxSampleBytes(): number {
  return Math.min(envFloat('ACRCLOUD_MAX_SAMPLE_BYTES', 5 * 1024 * 1024), 5 * 1024 * 1024);
}

/** En prod : erreur API = refus upload si false. */
export function isAcrCloudFailOpen(): boolean {
  if (isMsdevRuntime()) return envFlag('ACRCLOUD_FAIL_OPEN', true);
  return envFlag('ACRCLOUD_FAIL_OPEN', false);
}
