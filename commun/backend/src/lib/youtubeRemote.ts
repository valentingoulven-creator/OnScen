/**
 * Recherche / playlists YouTube via des proxys publics tiers non officiels
 * (Piped/Invidious) — métadonnées uniquement (jamais de flux audio/vidéo).
 *
 * ⚠️ NON CONFORME aux ToS YouTube. Fallback msdev/dev UNIQUEMENT.
 *
 * Défense en profondeur (voir audit RGPD/YouTube/Copyright, YT-2) :
 *   1. Garde-fou runtime : `isYoutubeRemoteFallbackAllowed()` (youtubeCompliance.ts)
 *      force `false` dès que NODE_ENV/APP_ENV === 'production', quelle que soit
 *      la valeur de ALLOW_YOUTUBE_REMOTE_FALLBACK.
 *   2. Exclusion du build : `npm run build:prod` (utilisé par
 *      commun/deploy/deploy_zero_downtime.ps1 pour prod ET preprod) supprime
 *      physiquement ce fichier compilé de `dist/lib/` via
 *      commun/backend/scripts/strip-dev-only-modules.js — même une mauvaise
 *      config d'env ne peut plus l'atteindre, car `import('./youtubeRemote')`
 *      échoue (ModuleNotFound) si le fichier est absent.
 *   3. Les deux seuls appelants (youtubeSearch.ts, youtubePlaylists.ts)
 *      importent ce module dynamiquement dans un try/catch : une absence du
 *      fichier (prod/preprod) dégrade proprement (pas de fallback) plutôt
 *      que de planter la requête.
 *
 * Ce fichier reste présent dans `dist/` uniquement pour le build msdev
 * (`npm run build` + `build:exe`) et le dev local (ts-node-dev sur `src/`),
 * où le fallback est un choix de confort explicite et documenté.
 */

/** Instances de repli si le registre public est injoignable. */
const PIPED_INSTANCES_FALLBACK = [
  'https://api.piped.private.coffee',
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.nosebs.ru',
  'https://pipedapi.orangenet.cc',
];

/** Registre officiel — instances triées par uptime (voir TeamPiped/documentation). */
const PIPED_INSTANCES_REGISTRY = 'https://piped-instances.kavin.rocks/';
const PIPED_INSTANCES_CACHE_TTL_MS = 60 * 60 * 1000;

const INVIDIOUS_INSTANCES = [
  'https://invidious.protokolla.fi',
  'https://invidious.nerdvpn.de',
];

let pipedInstancesCache: { urls: string[]; expiresAt: number } | null = null;

async function resolvePipedInstances(): Promise<string[]> {
  const now = Date.now();
  if (pipedInstancesCache && now < pipedInstancesCache.expiresAt) {
    return pipedInstancesCache.urls;
  }

  const seen = new Set<string>();
  const urls: string[] = [];
  const add = (raw: string) => {
    const normalized = raw.trim().replace(/\/$/, '');
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    urls.push(normalized);
  };

  for (const base of PIPED_INSTANCES_FALLBACK) add(base);

  const registry = await fetchJson<
    Array<{ api_url?: string; uptime_24h?: number }>
  >(PIPED_INSTANCES_REGISTRY, 6000);
  if (registry?.length) {
    const sorted = [...registry]
      .filter((entry) => typeof entry.api_url === 'string' && entry.api_url.trim())
      .sort((a, b) => (b.uptime_24h ?? 0) - (a.uptime_24h ?? 0));
    for (const entry of sorted) add(entry.api_url!);
  }

  pipedInstancesCache = { urls, expiresAt: now + PIPED_INSTANCES_CACHE_TTL_MS };
  return urls;
}

/** Réservé aux tests — invalide le cache d'instances Piped. */
export function __resetPipedInstancesCacheForTests(): void {
  pipedInstancesCache = null;
}

async function fetchJson<T>(url: string, timeoutMs = 8000): Promise<T | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export interface RemoteVideoHit {
  videoId: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
}

function thumb(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

export async function searchVideosViaPiped(query: string): Promise<RemoteVideoHit[]> {
  const instances = await resolvePipedInstances();
  for (const base of instances) {
    const data = await fetchJson<{
      items?: Array<{
        type?: string;
        title?: string;
        uploaderName?: string;
        thumbnail?: string;
        url?: string;
        videoId?: string;
      }>;
    }>(`${base}/search?q=${encodeURIComponent(query)}&filter=videos`);
    if (!data?.items?.length) continue;
    const hits: RemoteVideoHit[] = [];
    for (const item of data.items) {
      if (item.type && item.type !== 'stream') continue;
      let videoId = item.videoId;
      if (!videoId && item.url) {
        videoId = item.url.match(/[?&]v=([a-zA-Z0-9_-]{6,})/)?.[1] ?? item.url.match(/^\/watch\?v=([a-zA-Z0-9_-]{6,})/)?.[1];
      }
      if (!videoId) continue;
      hits.push({
        videoId,
        title: (item.title ?? 'Sans titre').slice(0, 120),
        artist: (item.uploaderName ?? 'YouTube').slice(0, 80),
        thumbnailUrl: item.thumbnail ?? thumb(videoId),
      });
      if (hits.length >= 12) break;
    }
    if (hits.length) return hits;
  }
  return [];
}

export async function searchVideosViaInvidious(query: string): Promise<RemoteVideoHit[]> {
  for (const base of INVIDIOUS_INSTANCES) {
    const data = await fetchJson<
      Array<{
        type?: string;
        title?: string;
        author?: string;
        videoId?: string;
        videoThumbnails?: Array<{ url?: string; quality?: string }>;
      }>
    >(`${base}/api/v1/search?q=${encodeURIComponent(query)}&type=video`);
    if (!data?.length) continue;
    const hits: RemoteVideoHit[] = [];
    for (const item of data) {
      if (item.type && item.type !== 'video') continue;
      if (!item.videoId) continue;
      const thumbs = item.videoThumbnails ?? [];
      const medium = thumbs.find((t) => t.quality === 'medium') ?? thumbs[0];
      hits.push({
        videoId: item.videoId,
        title: (item.title ?? 'Sans titre').slice(0, 120),
        artist: (item.author ?? 'YouTube').slice(0, 80),
        thumbnailUrl: medium?.url ?? thumb(item.videoId),
      });
      if (hits.length >= 12) break;
    }
    if (hits.length) return hits;
  }
  return [];
}

export async function fetchPlaylistVideosViaPiped(playlistId: string): Promise<RemoteVideoHit[]> {
  const instances = await resolvePipedInstances();
  for (const base of instances) {
    const data = await fetchJson<{
      relatedStreams?: Array<{
        title?: string;
        uploaderName?: string;
        thumbnail?: string;
        url?: string;
        videoId?: string;
      }>;
    }>(`${base}/playlists/${encodeURIComponent(playlistId)}`);
    if (!data?.relatedStreams?.length) continue;
    return data.relatedStreams
      .map((item) => {
        let videoId = item.videoId;
        if (!videoId && item.url) {
          videoId = item.url.match(/[?&]v=([a-zA-Z0-9_-]{6,})/)?.[1];
        }
        if (!videoId) return null;
        return {
          videoId,
          title: (item.title ?? 'Sans titre').slice(0, 120),
          artist: (item.uploaderName ?? 'YouTube').slice(0, 80),
          thumbnailUrl: item.thumbnail ?? thumb(videoId),
        };
      })
      .filter((x): x is RemoteVideoHit => Boolean(x))
      .slice(0, 50);
  }
  return [];
}
