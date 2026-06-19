import { parseMusicLink, buildPlatformTrackUrl } from './musicLinks';
import { searchCatalogYoutube } from './musicCatalog';
import { searchVideosViaDataApi } from './youtubeDataApi';
import { searchVideosViaInvidious, searchVideosViaPiped } from './youtubeRemote';
import { isYoutubeRemoteFallbackAllowed } from './youtubeCompliance';

export interface YoutubeSearchResult {
  videoId: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  externalUrl: string;
}

function thumbnailFor(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

function toResult(videoId: string, title: string, artist: string, thumbnailUrl?: string): YoutubeSearchResult {
  return {
    videoId,
    title: title.slice(0, 120),
    artist: artist.slice(0, 80),
    thumbnailUrl: thumbnailUrl ?? thumbnailFor(videoId),
    externalUrl: buildPlatformTrackUrl('youtube', videoId),
  };
}

async function fetchOEmbed(videoId: string): Promise<{ title: string; artist: string } | null> {
  try {
    const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(
      `https://www.youtube.com/watch?v=${videoId}`
    )}&format=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const data = (await res.json()) as { title?: string; author_name?: string };
    if (!data.title) return null;
    return {
      title: data.title,
      artist: data.author_name || 'YouTube',
    };
  } catch {
    return null;
  }
}

function dedupeResults(items: YoutubeSearchResult[]): YoutubeSearchResult[] {
  const seen = new Set<string>();
  const out: YoutubeSearchResult[] = [];
  for (const item of items) {
    if (seen.has(item.videoId)) continue;
    seen.add(item.videoId);
    out.push(item);
  }
  return out;
}

const GENERIC_YOUTUBE_TITLES = new Set(['vidéo youtube', 'sans titre', 'video youtube']);

/** Exclut les entrées sans métadonnées réelles (ex. oEmbed échoué → « Vidéo YouTube »). */
export function isCompleteYoutubeSearchResult(item: YoutubeSearchResult): boolean {
  const title = item.title.trim();
  const artist = item.artist.trim();
  if (!item.videoId || !title) return false;
  if (GENERIC_YOUTUBE_TITLES.has(title.toLowerCase())) return false;
  if (title.toLowerCase() === 'youtube' && (!artist || artist.toLowerCase() === 'youtube')) return false;
  return true;
}

function filterCompleteResults(items: YoutubeSearchResult[]): YoutubeSearchResult[] {
  return items.filter(isCompleteYoutubeSearchResult);
}

export async function searchYoutube(
  query: string,
  accessToken?: string
): Promise<YoutubeSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const parsed = parseMusicLink('youtube', q);
  if (parsed) {
    const meta = await fetchOEmbed(parsed.trackId);
    if (meta?.title) {
      return filterCompleteResults([
        toResult(parsed.trackId, meta.title, meta.artist ?? 'YouTube'),
      ]);
    }
  }

  const remoteHits: YoutubeSearchResult[] = [];

  const apiHits = await searchVideosViaDataApi(q, accessToken);
  for (const h of apiHits) {
    remoteHits.push(toResult(h.videoId, h.title, h.artist, h.thumbnailUrl));
  }

  if (isYoutubeRemoteFallbackAllowed()) {
    if (remoteHits.length < 8) {
      const piped = await searchVideosViaPiped(q);
      for (const h of piped) {
        remoteHits.push(toResult(h.videoId, h.title, h.artist, h.thumbnailUrl));
      }
    }

    if (remoteHits.length < 8) {
      const inv = await searchVideosViaInvidious(q);
      for (const h of inv) {
        remoteHits.push(toResult(h.videoId, h.title, h.artist, h.thumbnailUrl));
      }
    }
  }

  const catalogHits = searchCatalogYoutube(q, 6).map((entry) =>
    toResult(entry.youtube!.trackId, entry.title, entry.artist)
  );

  return filterCompleteResults(dedupeResults([...remoteHits, ...catalogHits])).slice(0, 15);
}
