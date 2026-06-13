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
      preferLowLatency: true,
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
