/** Recherche / playlists YouTube via API officielle ou instances publiques (secours). */

const PIPED_INSTANCES = [
  'https://pipedapi.adminforge.de',
  'https://pipedapi.in.projectsegfau.lt',
  'https://pipedapi.leptons.xyz',
  'https://pipedapi.kavin.rocks',
];

const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.privacydev.net',
  'https://yt.artemislena.eu',
  'https://invidious.nerdvpn.de',
];

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
  for (const base of PIPED_INSTANCES) {
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
  for (const base of PIPED_INSTANCES) {
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
