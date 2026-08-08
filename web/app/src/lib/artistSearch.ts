import { POPULAR_ARTISTS, type PopularArtist } from './popularArtists';



export interface ArtistSuggestion {

  label: string;

  subtitle?: string;

  value: string;

}



const MAX_SUGGESTIONS = 8;



/** Score de pertinence : plus bas = meilleur match. */

const MATCH_STARTS_WITH_NAME = 0;

const MATCH_CONTAINS_NAME = 1;

const MATCH_CONTAINS_GENRE = 2;



function normalize(s: string): string {

  return s.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');

}



function matchScore(artist: PopularArtist, q: string): number | null {

  const name = normalize(artist.name);

  const genre = normalize(artist.genre);

  if (name.startsWith(q)) return MATCH_STARTS_WITH_NAME;

  if (name.includes(q)) return MATCH_CONTAINS_NAME;

  if (genre.includes(q)) return MATCH_CONTAINS_GENRE;

  return null;

}



/**

 * Recherche locale dans la liste d'artistes populaires OnScen.

 * Insensible à la casse et aux accents ; priorité aux noms qui commencent par la requête.

 * L'utilisateur peut aussi saisir un nom personnalisé hors liste.

 */

export function searchArtists(query: string, exclude: string[] = []): ArtistSuggestion[] {

  const q = normalize(query);

  if (q.length < 2) return [];



  const excluded = new Set(exclude.map((e) => normalize(e)));



  return POPULAR_ARTISTS.filter((a) => !excluded.has(normalize(a.name)))

    .map((a) => ({ artist: a, score: matchScore(a, q) }))

    .filter((row): row is { artist: PopularArtist; score: number } => row.score !== null)

    .sort((a, b) => {

      if (a.score !== b.score) return a.score - b.score;

      return normalize(a.artist.name).localeCompare(normalize(b.artist.name), 'fr');

    })

    .slice(0, MAX_SUGGESTIONS)

    .map((row) => toSuggestion(row.artist));

}



function toSuggestion(a: PopularArtist): ArtistSuggestion {

  return { label: a.name, subtitle: a.genre, value: a.name };

}

