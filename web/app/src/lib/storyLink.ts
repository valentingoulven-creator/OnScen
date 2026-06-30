import type { StoryAppLinkTarget } from './storyAppLink';
import { parseStoryAppLink, storyAppLinkDefaultLabel } from './storyAppLink';

export interface StoryLinkInput {
  url: string;
  label?: string;
  x: number;
  y: number;
}

export const DEFAULT_STORY_LINK_POSITION = { x: 0.5, y: 0.78 } as const;

export function validateStoryLinkUrl(
  raw: string
): { ok: true; url: string } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: 'Saisissez une adresse web.' };
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    return { ok: false, error: "L'URL doit commencer par http:// ou https://." };
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { ok: false, error: 'Seuls http et https sont acceptés.' };
    }
    if (parsed.href.length > 2048) {
      return { ok: false, error: 'URL trop longue (max. 2048 caractères).' };
    }
    return { ok: true, url: parsed.href };
  } catch {
    return { ok: false, error: 'Adresse web invalide.' };
  }
}

export function storyLinkDisplayLabel(link: { url: string; label?: string }): string {
  const custom = link.label?.trim();
  if (custom) return custom;
  const appTarget = parseStoryAppLink(link.url);
  if (appTarget) return storyAppLinkDefaultLabel(appTarget);
  try {
    const host = new URL(link.url).hostname.replace(/^www\./i, '');
    return host || 'Voir plus';
  } catch {
    return 'Voir plus';
  }
}

export function resolveStoryLinkOpenTarget(url: string): StoryAppLinkTarget | 'external' | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  const appTarget = parseStoryAppLink(trimmed);
  if (appTarget) return appTarget;
  return 'external';
}
