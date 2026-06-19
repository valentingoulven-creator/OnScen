/** Spotify Jam — pas d'endpoint Web API public (conformité Spotify Developer Terms). */

export type SpotifyJamLinkKind = 'socialsession' | 'spotify_link';

export interface ParsedSpotifyJam {
  kind: SpotifyJamLinkKind;
  sessionId?: string;
  url: string;
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

function isMobileSpotify(): boolean {
  return typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

/** Ouvre un lien Jam Spotify (socialsession ou spotify.link). */
export function openSpotifyJamLink(storedUrl: string): void {
  if (typeof window === 'undefined') return;

  const parsed = parseSpotifyJamLink(storedUrl);
  const webUrl = parsed?.url ?? storedUrl.trim();
  if (!webUrl) return;

  if (parsed?.uri && parsed.kind === 'socialsession') {
    if (isMobileSpotify()) {
      window.location.assign(parsed.uri);
      window.setTimeout(() => window.location.assign(webUrl), 1200);
      return;
    }

    const anchor = document.createElement('a');
    anchor.href = parsed.uri;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    window.setTimeout(() => {
      window.open(webUrl, '_blank', 'noopener,noreferrer');
    }, 800);
    return;
  }

  if (isMobileSpotify()) {
    window.location.assign(webUrl);
    return;
  }

  window.open(webUrl, '_blank', 'noopener,noreferrer');
}

export const SPOTIFY_JAM_FIELD_HELP =
  'Optionnel — démarrez un Jam dans Spotify, puis copiez le lien d’invitation (spotify.link ou open.spotify.com/socialsession/…).';
