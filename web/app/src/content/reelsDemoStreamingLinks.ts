import { REEL_CATALOG_ENTRIES } from './reelsDemoCatalog';

/** Legacy API — un seul lien affiché ; conserver le type pour la normalisation feed. */
export interface ReelStreamingLinks {
  spotify?: string;
  youtube?: string;
  deezer?: string;
}

export const REELS_DEMO_VINYL_PACK_SIZE = 20;

const SPOTIFY_TRACKS = [
  'https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b',
  'https://open.spotify.com/track/7qiZfU4dY1lWllzX7mPBI3',
  'https://open.spotify.com/track/1mea3bSkSGXuirKPogTp06',
  'https://open.spotify.com/track/6FQNEnfiEpJpQH4iNbV9aI',
  'https://open.spotify.com/track/2tAKGu8C0H1u4NoFI4U1mn',
];

const YOUTUBE_TRACKS = [
  'https://www.youtube.com/watch?v=RgKAFK5djSk',
  'https://www.youtube.com/watch?v=ktvTqknDobU',
  'https://www.youtube.com/watch?v=fJ9rUzIMcZQ',
  'https://www.youtube.com/watch?v=OPf0YbXqDm0',
  'https://www.youtube.com/watch?v=60ItHLz5WEA',
];

const DEEZER_TRACKS = [
  'https://www.deezer.com/track/3135556',
  'https://www.deezer.com/track/916424',
  'https://www.deezer.com/track/766623',
  'https://www.deezer.com/track/1109731',
  'https://www.deezer.com/track/926132',
];

const DEMO_VINYL_REEL_IDS = REEL_CATALOG_ENTRIES.slice(0, REELS_DEMO_VINYL_PACK_SIZE).map((e) => e.id);

const DEMO_ALBUM_LINK_BY_REEL_ID: Record<string, string> = Object.fromEntries(
  DEMO_VINYL_REEL_IDS.map((id, index) => {
    const pool = index % 3 === 0 ? SPOTIFY_TRACKS : index % 3 === 1 ? YOUTUBE_TRACKS : DEEZER_TRACKS;
    const url = pool[Math.floor(index / 3) % pool.length]!;
    return [id, url];
  })
);

/** Lien unique (vinyle) pour les reels démo du pack msdev. */
export function getReelDemoAlbumLink(reelId: string): string | undefined {
  return DEMO_ALBUM_LINK_BY_REEL_ID[reelId];
}
