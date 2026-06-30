import { COUNTRY_CLASSIC_ARTISTS } from './countryClassic';
import { ELECTRONIC_ARTISTS } from './electronic';
import { FR_POP_CHANSON_ARTISTS } from './frPopChanson';
import { FR_RAP_ARTISTS } from './frRap';
import { HIP_HOP_ARTISTS } from './hipHop';
import { JAZZ_ARTISTS } from './jazz';
import { POP_ARTISTS } from './pop';
import { ROCK_INDIE_ARTISTS } from './rockIndie';
import { RNB_SOUL_ARTISTS } from './rnbSoul';
import type { PopularArtist } from './types';
import { WORLD_LATIN_ARTISTS } from './worldLatin';

export type { PopularArtist } from './types';

function normalizeKey(name: string): string {
  return name.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

function dedupeArtists(artists: PopularArtist[]): PopularArtist[] {
  const seen = new Set<string>();
  const out: PopularArtist[] = [];
  for (const artist of artists) {
    const key = normalizeKey(artist.name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(artist);
  }
  return out;
}

const ALL_ARTISTS: PopularArtist[] = [
  ...FR_RAP_ARTISTS,
  ...FR_POP_CHANSON_ARTISTS,
  ...HIP_HOP_ARTISTS,
  ...POP_ARTISTS,
  ...RNB_SOUL_ARTISTS,
  ...ROCK_INDIE_ARTISTS,
  ...ELECTRONIC_ARTISTS,
  ...JAZZ_ARTISTS,
  ...WORLD_LATIN_ARTISTS,
  ...COUNTRY_CLASSIC_ARTISTS,
];

/** Liste curatée d'artistes populaires Soundy — FR + international, tous genres. */
export const POPULAR_ARTISTS: PopularArtist[] = dedupeArtists(ALL_ARTISTS);
