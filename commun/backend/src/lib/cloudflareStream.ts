/**
 * Cloudflare Stream Live Input API client.
 * RTMP ingest → HLS playback via CDN (recording.mode = automatic).
 */

const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

export interface CloudflareLiveInputCredentials {
  uid: string;
  rtmpsUrl: string;
  rtmpsStreamKey: string;
  playbackHlsUrl: string;
  whipUrl?: string;
  customerSubdomain: string;
}

interface CfApiResponse<T> {
  success: boolean;
  errors?: { message: string }[];
  result?: T;
}

interface CfLiveInputRaw {
  uid: string;
  enabled?: boolean;
  preferLowLatency?: boolean;
  rtmps?: { url?: string; streamKey?: string };
  webRTC?: { url?: string };
  meta?: { name?: string };
}

function getAccountId(): string {
  return (process.env.CLOUDFLARE_ACCOUNT_ID ?? '').trim();
}

function getApiToken(): string {
  return (
    process.env.CLOUDFLARE_STREAM_API_TOKEN?.trim() ||
    process.env.CLOUDFLARE_API_TOKEN?.trim() ||
    ''
  );
}

/** True when account id + API token are set (Stream permissions required on token). */
export function isCloudflareStreamConfigured(): boolean {
  return Boolean(getAccountId() && getApiToken());
}

function extractCustomerSubdomain(raw: CfLiveInputRaw): string {
  const fromEnv = process.env.CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN?.trim();
  if (fromEnv) return fromEnv;

  const webRtcUrl = raw.webRTC?.url ?? '';
  const match = webRtcUrl.match(/customer-([a-z0-9]+)\.cloudflarestream\.com/i);
  if (match?.[1]) return match[1];

  throw new Error(
    'Sous-domaine Cloudflare Stream introuvable. Définissez CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN dans .env (ex. m033z5x00ks6nunl).'
  );
}

export function buildHlsPlaybackUrl(customerSubdomain: string, liveInputId: string): string {
  return `https://customer-${customerSubdomain}.cloudflarestream.com/${liveInputId}/manifest/video.m3u8`;
}

/** RTMP non chiffré — secours si OBS échoue sur RTMPS (certificat TLS / version OBS). */
export const CLOUDFLARE_RTMP_INGEST_URL = 'rtmp://live.cloudflare.com:1935/live/';

export const CLOUDFLARE_RTMPS_INGEST_URL = 'rtmps://live.cloudflare.com:443/live/';

export function normalizeCloudflareIngestForObs(creds: CloudflareLiveInputCredentials): {
  rtmpsUrl: string;
  rtmpUrl: string;
  streamKey: string;
} {
  let rtmpsUrl = creds.rtmpsUrl.trim() || CLOUDFLARE_RTMPS_INGEST_URL;
  const streamKey = creds.rtmpsStreamKey.trim();
  if (streamKey && rtmpsUrl.endsWith(streamKey)) {
    rtmpsUrl = rtmpsUrl.slice(0, -streamKey.length);
  }
  if (!rtmpsUrl.endsWith('/')) rtmpsUrl += '/';
  return {
    rtmpsUrl,
    rtmpUrl: CLOUDFLARE_RTMP_INGEST_URL,
    streamKey,
  };
}

function mapLiveInput(raw: CfLiveInputRaw): CloudflareLiveInputCredentials {
  const customerSubdomain = extractCustomerSubdomain(raw);
  const rtmpsUrl = raw.rtmps?.url?.trim() ?? 'rtmps://live.cloudflare.com:443/live/';
  const rtmpsStreamKey = raw.rtmps?.streamKey?.trim() ?? '';
  if (!raw.uid || !rtmpsStreamKey) {
    throw new Error('Réponse Cloudflare Stream incomplète (uid ou clé RTMP manquante).');
  }
  return {
    uid: raw.uid,
    rtmpsUrl,
    rtmpsStreamKey,
    playbackHlsUrl: buildHlsPlaybackUrl(customerSubdomain, raw.uid),
    whipUrl: raw.webRTC?.url,
    customerSubdomain,
  };
}

async function cfRequest<T>(
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<T> {
  const accountId = getAccountId();
  const token = getApiToken();
  if (!accountId || !token) {
    throw new Error('Cloudflare Stream non configuré (CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_STREAM_API_TOKEN).');
  }

  const res = await fetch(`${CF_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = (await res.json().catch(() => ({}))) as CfApiResponse<T>;
  if (!res.ok || !json.success) {
    const msg =
      json.errors?.map((e) => e.message).join('; ') ||
      `Cloudflare API HTTP ${res.status}`;
    throw new Error(msg);
  }
  if (json.result === undefined) {
    throw new Error('Réponse Cloudflare Stream vide.');
  }
  return json.result;
}

/** Create a live input with automatic HLS recording/playback. */
export async function createCloudflareLiveInput(meta: {
  name: string;
}): Promise<CloudflareLiveInputCredentials> {
  const accountId = getAccountId();
  const raw = await cfRequest<CfLiveInputRaw>(
    'POST',
    `/accounts/${accountId}/stream/live_inputs`,
    {
      meta: { name: meta.name },
      recording: { mode: 'automatic' },
      enabled: true,
      // RTMP/OBS : preferLowLatency exige GOP très court — instabilité fréquente avec OBS par défaut.
      preferLowLatency: false,
    }
  );
  return mapLiveInput(raw);
}

/** Fetch existing live input credentials (host refresh). */
export async function getCloudflareLiveInput(
  liveInputId: string
): Promise<CloudflareLiveInputCredentials> {
  const accountId = getAccountId();
  const raw = await cfRequest<CfLiveInputRaw>(
    'GET',
    `/accounts/${accountId}/stream/live_inputs/${liveInputId}`
  );
  return mapLiveInput(raw);
}

/** Stop accepting new RTMP connections (end broadcast gracefully). */
export async function disableCloudflareLiveInput(liveInputId: string): Promise<void> {
  const accountId = getAccountId();
  await cfRequest<CfLiveInputRaw>(
    'PUT',
    `/accounts/${accountId}/stream/live_inputs/${liveInputId}`,
    { enabled: false }
  );
}

/** Re-enable ingest + mode standard (désactive LL-HLS / LTX incompatible OBS par défaut). */
export async function stabilizeCloudflareLiveInputForObs(
  liveInputId: string,
  opts?: { force?: boolean; customerSubdomain?: string }
): Promise<boolean> {
  const accountId = getAccountId();
  if (!opts?.force) {
    const raw = await cfRequest<CfLiveInputRaw>(
      'GET',
      `/accounts/${accountId}/stream/live_inputs/${liveInputId}`
    );
    // undefined !== false provoquait un PUT à chaque live alors que le mode est déjà standard.
    const needsUpdate = raw.enabled === false || raw.preferLowLatency === true;
    if (!needsUpdate) return false;
  }

  if (!opts?.force) {
    try {
      const subdomain =
        opts?.customerSubdomain?.trim() ||
        process.env.CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN?.trim() ||
        '';
      if (subdomain) {
        const lifecycle = await getCloudflareLiveInputLifecycle(liveInputId, subdomain);
        if (lifecycle.live) {
          console.warn(
            '[cloudflare-stream] stabilize ignoré — flux RTMP actif sur',
            liveInputId
          );
          return false;
        }
      }
    } catch {
      /* lifecycle indisponible — on continue */
    }
  }

  await cfRequest<CfLiveInputRaw>(
    'PUT',
    `/accounts/${accountId}/stream/live_inputs/${liveInputId}`,
    {
      enabled: true,
      preferLowLatency: false,
      recording: { mode: 'automatic' },
    }
  );
  return true;
}

/** Re-enable ingest only when disabled ou mode LL actif. */
export async function ensureCloudflareLiveInputEnabled(liveInputId: string): Promise<void> {
  await stabilizeCloudflareLiveInputForObs(liveInputId);
}

/** Delete live input (cleanup after live ends). */
export async function deleteCloudflareLiveInput(liveInputId: string): Promise<void> {
  const accountId = getAccountId();
  const token = getApiToken();
  const res = await fetch(
    `${CF_API_BASE}/accounts/${accountId}/stream/live_inputs/${liveInputId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as CfApiResponse<unknown>;
    const msg =
      json.errors?.map((e) => e.message).join('; ') ||
      `Cloudflare DELETE HTTP ${res.status}`;
    throw new Error(msg);
  }
}

interface CfLiveInputVideoRaw {
  uid: string;
  created?: string;
  status?: { state?: string };
  playback?: { hls?: string };
}

/** HLS VOD de la dernière diffusion enregistrée après `startedAfterMs` (live input partagé). */
export async function resolveLatestRecordingHlsUrl(
  liveInputId: string,
  startedAfterMs: number
): Promise<string | undefined> {
  const accountId = getAccountId();
  const videos = await cfRequest<CfLiveInputVideoRaw[]>(
    'GET',
    `/accounts/${accountId}/stream/live_inputs/${liveInputId}/videos`
  );
  const afterIso = new Date(Math.max(0, startedAfterMs - 60_000)).toISOString();
  let best: { created: string; hls: string } | undefined;
  for (const video of videos) {
    const state = video.status?.state;
    if (state === 'live-inprogress') continue;
    const hls = video.playback?.hls?.trim();
    const created = video.created ?? '';
    if (!hls || !created || created < afterIso) continue;
    if (!best || created > best.created) best = { created, hls };
  }
  return best?.hls;
}

export interface CloudflareLiveInputLifecycle {
  live: boolean;
  videoUid: string | null;
  status?: string;
}

/** État RTMP en direct (OBS connecté ou non) — endpoint public Cloudflare. */
export async function getCloudflareLiveInputLifecycle(
  liveInputId: string,
  customerSubdomain?: string
): Promise<CloudflareLiveInputLifecycle> {
  const subdomain =
    customerSubdomain?.trim() ||
    process.env.CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN?.trim() ||
    '';
  if (!subdomain) {
    throw new Error('CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN manquant.');
  }
  const url = `https://customer-${subdomain}.cloudflarestream.com/${liveInputId}/lifecycle`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Lifecycle Cloudflare HTTP ${res.status}`);
  }
  const json = (await res.json()) as {
    live?: boolean;
    videoUID?: string | null;
    status?: string;
  };
  return {
    live: json.live === true,
    videoUid: json.videoUID ?? null,
    status: json.status,
  };
}

export interface CloudflareStreamIngestQuota {
  /** false si le compte Cloudflare n'a aucun quota Stream (ingest RTMP rejeté). */
  ingestAllowed: boolean;
  totalStorageMinutesLimit: number;
  videoCount: number;
}

/** Vérifie que le compte Cloudflare Stream accepte l'ingest live (quota > 0). */
export async function getCloudflareStreamIngestQuota(): Promise<CloudflareStreamIngestQuota> {
  const accountId = getAccountId();
  const raw = await cfRequest<{
    videoCount?: number;
    totalStorageMinutes?: number;
    totalStorageMinutesLimit?: number;
  }>('GET', `/accounts/${accountId}/stream/storage-usage`);
  const limit = raw.totalStorageMinutesLimit ?? 0;
  const videoCount = raw.videoCount ?? 0;
  return {
    ingestAllowed: limit > 0,
    totalStorageMinutesLimit: limit,
    videoCount,
  };
}
