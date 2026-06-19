/** Spotify Jam — pas d'endpoint Web API public (voir community.spotify.com Live Ideas). */

export type SpotifyJamLinkKind = 'socialsession' | 'spotify_link';

export interface ParsedSpotifyJam {
  kind: SpotifyJamLinkKind;
  sessionId?: string;
  /** URL web canonique ou lien court spotify.link */
  url: string;
  /** URI spotify:socialsession:… pour ouvrir l'app native (socialsession uniquement) */
  uri?: string;
}

const WEB_JAM_RE = /open\.spotify\.com\/socialsession\/([A-Za-z0-9]+)/i;
const URI_JAM_RE = /^spotify:socialsession:([A-Za-z0-9]+)$/i;
const SPOTIFY_LINK_RE = /(?:https?:\/\/)?(?:www\.)?spotify\.link\/([A-Za-z0-9_-]+)/i;

export function parseSpotifyJamLink(input: string): ParsedSpotifyJam | null {
  const raw = input.trim();
  if (!raw) return null;

  const web = raw.match(WEB_JAM_RE);
  if (web) return buildSocialSessionParsed(web[1]);

  const uri = raw.match(URI_JAM_RE);
  if (uri) return buildSocialSessionParsed(uri[1]);

  const short = raw.match(SPOTIFY_LINK_RE);
  if (short) {
    return {
      kind: 'spotify_link',
      url: `https://spotify.link/${short[1]}`,
    };
  }

  return null;
}

export function normalizeSpotifyJamUrl(input: string): string | null {
  return parseSpotifyJamLink(input)?.url ?? null;
}

function buildSocialSessionParsed(sessionId: string): ParsedSpotifyJam {
  return {
    kind: 'socialsession',
    sessionId,
    url: `https://open.spotify.com/socialsession/${sessionId}`,
    uri: `spotify:socialsession:${sessionId}`,
  };
}
