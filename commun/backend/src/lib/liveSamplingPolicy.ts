import { isDeployedEnv } from './jwtSecret';

/**
 * Lives WebRTC mesh / LiveKit sans relais Cloudflare = pas d'échantillonnage
 * Sightengine. En prod/staging, interdit sauf opt-in explicite.
 */
export function allowUnsampledLive(): boolean {
  if (!isDeployedEnv()) return true;
  const raw = process.env.ALLOW_UNSAMPLED_LIVE?.trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

export function unsampledLiveResponse(): { error: string; code: string } {
  return {
    error:
      'Les lives caméra publics doivent être échantillonnés (relais LiveKit → Cloudflare Stream). ' +
      'Cloudflare Stream et LiveKit sont requis, ou définissez ALLOW_UNSAMPLED_LIVE=1 (non recommandé).',
    code: 'LIVE_SAMPLING_REQUIRED',
  };
}
