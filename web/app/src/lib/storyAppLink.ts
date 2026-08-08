import { getAlbumPath, getCompositionPath, resolveShareOrigin } from './shareLink';

export type StoryAppLinkKind = 'album' | 'composition';

export interface StoryAppLinkTarget {
  kind: StoryAppLinkKind;
  userId: string;
  albumId?: string;
  compositionId?: string;
}

export const STORY_APP_LINK_EVENT = 'onscen:story-app-link';

export function parseStoryAppLink(url: string): StoryAppLinkTarget | null {
  try {
    const parsed = new URL(url.trim());
    const pathMatch = parsed.pathname.match(/^\/profile\/([^/]+)\/?$/i);
    if (!pathMatch) return null;
    const host = parsed.hostname.toLowerCase();
    const allowedHosts = new Set(['getsoundy.com', 'www.getsoundy.com', 'localhost', '127.0.0.1']);
    if (typeof window !== 'undefined') {
      allowedHosts.add(window.location.hostname.toLowerCase());
    }
    if (!allowedHosts.has(host)) return null;
    const userId = decodeURIComponent(pathMatch[1]!);
    if (parsed.searchParams.get('tab') !== 'compositions') return null;
    const albumId = parsed.searchParams.get('album')?.trim();
    const compositionId = parsed.searchParams.get('track')?.trim();
    if (albumId) return { kind: 'album', userId, albumId };
    if (compositionId) return { kind: 'composition', userId, compositionId };
    return null;
  } catch {
    return null;
  }
}

export function isStoryAppLink(url: string): boolean {
  return parseStoryAppLink(url) != null;
}

export async function buildStoryAlbumLink(userId: string, albumId: string): Promise<string> {
  const base = await resolveShareOrigin();
  return `${base.replace(/\/$/, '')}${getAlbumPath(userId, albumId)}`;
}

export async function buildStoryCompositionLink(
  userId: string,
  compositionId: string
): Promise<string> {
  const base = await resolveShareOrigin();
  return `${base.replace(/\/$/, '')}${getCompositionPath(userId, compositionId)}`;
}

export function dispatchStoryAppLink(target: StoryAppLinkTarget): void {
  window.dispatchEvent(new CustomEvent(STORY_APP_LINK_EVENT, { detail: target }));
}

export function storyAppLinkDefaultLabel(target: StoryAppLinkTarget): string {
  return target.kind === 'album' ? 'Album' : 'Son';
}
