/** Spotify Jam — pas d'endpoint Web API public (conformité Spotify Developer Terms). */

export interface ParsedSpotifyJam {
  sessionId: string;
  url: string;
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

export const SPOTIFY_JAM_AUTO_FETCH_UNAVAILABLE =
  'Démarrez un Jam dans l\'application Spotify, copiez le lien d\'invitation, puis collez-le ici.';

export const SPOTIFY_JAM_START_HINT =
  "Dans Spotify : icône haut-parleur (en bas) → Démarrer un Jam → Inviter → Copier le lien.";
