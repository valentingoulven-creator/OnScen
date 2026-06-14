/** Spotify Jam — pas d'endpoint Web API public (voir community.spotify.com Live Ideas). */

export interface ParsedSpotifyJam {
  sessionId: string;
  /** URL canonique https://open.spotify.com/socialsession/… */
  url: string;
  /** URI spotify:socialsession:… pour ouvrir l'app native */
  uri: string;
}

const WEB_JAM_RE = /open\.spotify\.com\/socialsession\/([A-Za-z0-9]+)/i;
const URI_JAM_RE = /^spotify:socialsession:([A-Za-z0-9]+)$/i;

export function parseSpotifyJamLink(input: string): ParsedSpotifyJam | null {
  const raw = input.trim();
  if (!raw) return null;

  const web = raw.match(WEB_JAM_RE);
  if (web) return buildParsed(web[1]);

  const uri = raw.match(URI_JAM_RE);
  if (uri) return buildParsed(uri[1]);

  return null;
}

export function normalizeSpotifyJamUrl(input: string): string | null {
  return parseSpotifyJamLink(input)?.url ?? null;
}

function buildParsed(sessionId: string): ParsedSpotifyJam {
  return {
    sessionId,
    url: `https://open.spotify.com/socialsession/${sessionId}`,
    uri: `spotify:socialsession:${sessionId}`,
  };
}
