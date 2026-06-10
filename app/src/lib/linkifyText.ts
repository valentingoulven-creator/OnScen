import { parseProfileIdFromLocation } from './profileDeepLink';
import { parseSalonIdFromLocation } from './salonDeepLink';

export type InternalLinkTarget =
  | { kind: 'post'; postId: string }
  | { kind: 'profile'; userId: string }
  | { kind: 'salon'; salonId: string };

export type LinkifySegment =
  | { type: 'text'; value: string }
  | { type: 'link'; display: string; href: string; internal: InternalLinkTarget | null };

const URL_PATTERN =
  /https?:\/\/[^\s<>"']+|#\/(?:post|profile|salon)\/[^\s<>"']+|\/(?:profile|salon)\/[^\s<>"']+/gi;

function splitTrailingPunctuation(value: string): { core: string; trailing: string } {
  const m = value.match(/^(.+?)([.,;:!?]+)$/);
  if (!m) return { core: value, trailing: '' };
  return { core: m[1], trailing: m[2] };
}

function isSoundyHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (typeof window !== 'undefined' && h === window.location.hostname.toLowerCase()) return true;
  return h === 'getsoundy.com' || h.endsWith('.getsoundy.com') || h === 'localhost' || h === '127.0.0.1';
}

function parseHashRoute(hash: string): InternalLinkTarget | null {
  const m = hash.match(/^#\/(post|profile|salon)\/([^/?#\s]+)/i);
  if (!m) return null;
  const id = decodeURIComponent(m[2]);
  const kind = m[1].toLowerCase();
  if (kind === 'post') return { kind: 'post', postId: id };
  if (kind === 'profile') return { kind: 'profile', userId: id };
  return { kind: 'salon', salonId: id };
}

/** Resolve Soundy in-app targets from a URL fragment, path, or full http(s) link. */
export function resolveInternalLink(raw: string): InternalLinkTarget | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const hashOnly = parseHashRoute(trimmed.startsWith('#') ? trimmed : `#${trimmed.replace(/^#/, '')}`);
  if (hashOnly && trimmed.startsWith('#/')) return hashOnly;

  try {
    const url = trimmed.startsWith('http')
      ? new URL(trimmed)
      : trimmed.startsWith('/')
        ? new URL(trimmed, typeof window !== 'undefined' ? window.location.origin : 'https://getsoundy.com')
        : null;

    if (!url) return null;

    const fromHash = url.hash ? parseHashRoute(url.hash) : null;
    if (fromHash && isSoundyHost(url.hostname)) return fromHash;

    const fakeLoc = { pathname: url.pathname, search: url.search, hash: url.hash } as Location;
    const profileId = parseProfileIdFromLocation(fakeLoc);
    if (profileId && isSoundyHost(url.hostname)) return { kind: 'profile', userId: profileId };

    const salonId = parseSalonIdFromLocation(fakeLoc);
    if (salonId && isSoundyHost(url.hostname)) return { kind: 'salon', salonId };

    return null;
  } catch {
    return null;
  }
}

function normalizeHref(raw: string): string {
  if (raw.startsWith('http') || raw.startsWith('/')) return raw;
  if (raw.startsWith('#/')) return raw;
  return raw;
}

/** Split plain text into text and link segments (http(s), hash routes, profile/salon paths). */
export function splitTextWithLinks(text: string): LinkifySegment[] {
  if (!text) return [];

  const segments: LinkifySegment[] = [];
  let lastIndex = 0;
  const re = new RegExp(URL_PATTERN.source, 'gi');
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }

    const matched = match[0];
    const { core, trailing } = splitTrailingPunctuation(matched);
    segments.push({
      type: 'link',
      display: core,
      href: normalizeHref(core),
      internal: resolveInternalLink(core),
    });

    if (trailing) {
      segments.push({ type: 'text', value: trailing });
    }

    lastIndex = match.index + matched.length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: 'text', value: text }];
}
