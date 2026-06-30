import { db } from '../models/schema';
import {
  createCloudflareLiveInput,
  deleteCloudflareLiveInput,
  getCloudflareLiveInput,
  getCloudflareLiveInputLifecycle,
  isCloudflareStreamConfigured,
  normalizeCloudflareIngestForObs,
  stabilizeCloudflareLiveInputForObs,
  type CloudflareLiveInputCredentials,
} from './cloudflareStream';
import { assertCanUseCloudflareObs } from './platformPlans';
import { schedulePersistUserToPg } from './pgUsers';
import { getIo } from './ioInstance';
import { serializePublicLive } from './livePublic';
import { persistLiveToPgAsync } from './pgSalonsLives';

export type UserObsIngestPayload = {
  rtmpsUrl: string;
  rtmpUrl: string;
  streamKey: string;
  playbackUrl: string;
  whipUrl?: string;
  liveInputId: string;
  /** Clé RTMP liée au compte Soundy (réutilisée à chaque live OBS). */
  persistent: true;
};

function toIngestPayload(creds: CloudflareLiveInputCredentials): UserObsIngestPayload {
  const ingest = normalizeCloudflareIngestForObs(creds);
  return {
    rtmpsUrl: ingest.rtmpsUrl,
    rtmpUrl: ingest.rtmpUrl,
    streamKey: ingest.streamKey,
    playbackUrl: creds.playbackHlsUrl,
    whipUrl: creds.whipUrl,
    liveInputId: creds.uid,
    persistent: true,
  };
}

async function createAndPersistUserObsLiveInput(userId: string): Promise<CloudflareLiveInputCredentials> {
  const user = db.users.get(userId);
  if (!user) throw new Error('Utilisateur introuvable');

  const creds = await createCloudflareLiveInput({
    name: `Soundy OBS — ${user.username} (${user.id})`,
  });
  user.cloudflareObsLiveInputId = creds.uid;
  db.users.set(userId, user);
  schedulePersistUserToPg(user);
  return creds;
}

/**
 * Début de live OBS — lit l’input persistant sans PUT Cloudflare (évite reset RTMP si OBS
 * est déjà connecté ou en train de publier). Réparation explicite via obs-stream-repair.
 */
export async function getOrCreateUserObsLiveInput(
  userId: string
): Promise<CloudflareLiveInputCredentials> {
  if (!isCloudflareStreamConfigured()) {
    throw new Error('Cloudflare Stream non configuré sur le serveur.');
  }
  const user = db.users.get(userId);
  if (!user) throw new Error('Utilisateur introuvable');

  if (user.cloudflareObsLiveInputId) {
    return getCloudflareLiveInput(user.cloudflareObsLiveInputId);
  }

  return createAndPersistUserObsLiveInput(userId);
}

/** Lecture identifiants RTMP — GET Cloudflare uniquement (ne touche pas enabled / clé). */
export async function fetchUserObsIngest(userId: string): Promise<UserObsIngestPayload> {
  assertCanUseCloudflareObs(userId);
  const user = db.users.get(userId);
  if (!user) throw new Error('Utilisateur introuvable');

  if (user.cloudflareObsLiveInputId) {
    try {
      const creds = await getCloudflareLiveInput(user.cloudflareObsLiveInputId);
      return toIngestPayload(creds);
    } catch (err) {
      console.error('[obs-stream] lecture live input:', err);
      throw new Error(
        'Impossible de lire les identifiants RTMP. Utilisez « Changer la clé » si le problème persiste.',
        { cause: err }
      );
    }
  }

  const creds = await createAndPersistUserObsLiveInput(userId);
  return toIngestPayload(creds);
}

function syncActiveCloudflareLive(userId: string, creds: CloudflareLiveInputCredentials): void {
  const activeLive = [...db.lives.values()].find(
    (l) => l.hostId === userId && l.isActive && l.streamMode === 'cloudflare'
  );
  if (!activeLive) return;
  if (
    activeLive.cloudflareLiveInputId === creds.uid &&
    activeLive.cloudflarePlaybackUrl === creds.playbackHlsUrl
  ) {
    return;
  }
  activeLive.cloudflareLiveInputId = creds.uid;
  activeLive.cloudflarePlaybackUrl = creds.playbackHlsUrl;
  activeLive.cloudflareCustomerSubdomain = creds.customerSubdomain;
  db.lives.set(activeLive.id, activeLive);
  persistLiveToPgAsync(activeLive);
  getIo()?.to(`live_${activeLive.id}`).emit('live_updated', serializePublicLive(activeLive));
}

/** Supprime l'ancien live input Cloudflare et en crée un nouveau (nouvelle clé RTMP). */
export async function rotateUserObsStreamKey(userId: string): Promise<UserObsIngestPayload> {
  assertCanUseCloudflareObs(userId);
  const user = db.users.get(userId);
  if (!user) throw new Error('Utilisateur introuvable');

  const oldId = user.cloudflareObsLiveInputId;
  if (oldId) {
    try {
      await deleteCloudflareLiveInput(oldId);
    } catch (err) {
      console.warn('[obs-stream] suppression ancien live input:', err);
    }
  }

  user.cloudflareObsLiveInputId = undefined;
  db.users.set(userId, user);
  const creds = await createAndPersistUserObsLiveInput(userId);
  syncActiveCloudflareLive(userId, creds);
  return toIngestPayload(creds);
}

/** Corrige un live input existant (LL-HLS / LTX off) sans changer la clé RTMP. */
export async function repairUserObsStreamInput(userId: string): Promise<UserObsIngestPayload> {
  assertCanUseCloudflareObs(userId);
  const user = db.users.get(userId);
  if (!user) throw new Error('Utilisateur introuvable');
  if (!user.cloudflareObsLiveInputId) {
    return fetchUserObsIngest(userId);
  }

  const credsPreview = await getCloudflareLiveInput(user.cloudflareObsLiveInputId);
  const lifecycle = await getCloudflareLiveInputLifecycle(
    user.cloudflareObsLiveInputId,
    credsPreview.customerSubdomain
  ).catch(() => ({ live: false, videoUid: null as string | null }));
  if (lifecycle.live) {
    const err = new Error(
      'Arrêtez la diffusion OBS avant de réparer la connexion (sinon Cloudflare coupe le flux).'
    ) as Error & { code?: string };
    err.code = 'obs_stream_active';
    throw err;
  }

  await stabilizeCloudflareLiveInputForObs(user.cloudflareObsLiveInputId, { force: true });
  return toIngestPayload(await getCloudflareLiveInput(user.cloudflareObsLiveInputId));
}

export function isUserPersistentObsLiveInput(userId: string, liveInputId: string): boolean {
  const user = db.users.get(userId);
  return Boolean(user?.cloudflareObsLiveInputId && user.cloudflareObsLiveInputId === liveInputId);
}
