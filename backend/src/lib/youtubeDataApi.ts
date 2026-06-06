import type { RemoteVideoHit } from './youtubeRemote';

function apiKey(): string | undefined {
  return process.env.YOUTUBE_API_KEY?.trim() || undefined;
}

function thumb(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

export async function searchVideosViaDataApi(query: string): Promise<RemoteVideoHit[]> {
  const key = apiKey();
  if (!key) return [];
  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    maxResults: '12',
    q: query,
    key,
  });
  const data = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, {
    signal: AbortSignal.timeout(8000),
  }).then((r) => (r.ok ? r.json() : null) as Promise<{
    items?: Array<{
      id?: { videoId?: string };
      snippet?: { title?: string; channelTitle?: string; thumbnails?: { medium?: { url?: string } } };
    }>;
  } | null>);
  if (!data?.items) return [];
  const out: RemoteVideoHit[] = [];
  for (const item of data.items) {
    const videoId = item.id?.videoId;
    if (!videoId) continue;
    out.push({
      videoId,
      title: (item.snippet?.title ?? 'Sans titre').slice(0, 120),
      artist: (item.snippet?.channelTitle ?? 'YouTube').slice(0, 80),
      thumbnailUrl: item.snippet?.thumbnails?.medium?.url ?? thumb(videoId),
    });
  }
  return out;
}

export interface YoutubePlaylistSummary {
  playlistId: string;
  title: string;
  itemCount?: number;
  thumbnailUrl?: string;
}

export async function listMyPlaylists(accessToken: string): Promise<YoutubePlaylistSummary[]> {
  const out: YoutubePlaylistSummary[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      part: 'snippet,contentDetails',
      mine: 'true',
      maxResults: '25',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const res = await fetch(`https://www.googleapis.com/youtube/v3/playlists?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) break;
    const data = (await res.json()) as {
      items?: Array<{
        id?: string;
        snippet?: { title?: string; thumbnails?: { medium?: { url?: string } } };
        contentDetails?: { itemCount?: number };
      }>;
      nextPageToken?: string;
    };
    for (const item of data.items ?? []) {
      if (!item.id) continue;
      out.push({
        playlistId: item.id,
        title: (item.snippet?.title ?? 'Playlist').slice(0, 120),
        itemCount: item.contentDetails?.itemCount,
        thumbnailUrl: item.snippet?.thumbnails?.medium?.url,
      });
    }
    pageToken = data.nextPageToken;
    if (out.length >= 50) break;
  } while (pageToken);
  return out;
}

export async function fetchPlaylistItems(
  playlistId: string,
  accessToken?: string
): Promise<RemoteVideoHit[]> {
  const key = apiKey();
  if (!key && !accessToken) return [];

  const out: RemoteVideoHit[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      part: 'snippet,contentDetails',
      playlistId,
      maxResults: '50',
    });
    if (pageToken) params.set('pageToken', pageToken);
    if (key) params.set('key', key);

    const res = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?${params}`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) break;
    const data = (await res.json()) as {
      items?: Array<{
        snippet?: {
          title?: string;
          videoOwnerChannelTitle?: string;
          channelTitle?: string;
          thumbnails?: { medium?: { url?: string } };
          resourceId?: { videoId?: string };
        };
      }>;
      nextPageToken?: string;
    };
    for (const item of data.items ?? []) {
      const videoId = item.snippet?.resourceId?.videoId;
      if (!videoId || videoId === 'deleted') continue;
      const title = item.snippet?.title ?? 'Sans titre';
      if (title === 'Private video' || title === 'Deleted video') continue;
      out.push({
        videoId,
        title: title.slice(0, 120),
        artist: (item.snippet?.videoOwnerChannelTitle ?? item.snippet?.channelTitle ?? 'YouTube').slice(
          0,
          80
        ),
        thumbnailUrl: item.snippet?.thumbnails?.medium?.url ?? thumb(videoId),
      });
    }
    pageToken = data.nextPageToken;
    if (out.length >= 50) break;
  } while (pageToken);

  return out;
}
