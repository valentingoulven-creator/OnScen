import type { StoryTaggedUser } from '../types';

/** Mention @username en cours de saisie dans un overlay texte story. */
export interface ActiveStoryMention {
  query: string;
  start: number;
  end: number;
}

/** Utilisateur tagué inline dans un calque texte (sans sticker séparé). */
export interface StoryTextMentionRef {
  id: string;
  username: string;
}

type TextOverlayMentionSource = {
  text?: string;
  mentionRefs?: StoryTextMentionRef[];
};

const MENTION_BEFORE_CURSOR = /(^|[\s])@([\w.]*)$/;

/** Détecte une mention @ incomplète juste avant le curseur. */
export function parseActiveStoryMention(
  text: string,
  cursor: number
): ActiveStoryMention | null {
  const before = text.slice(0, Math.max(0, cursor));
  const match = MENTION_BEFORE_CURSOR.exec(before);
  if (!match) return null;
  const query = match[2] ?? '';
  const start = cursor - query.length - 1;
  return { query, start, end: cursor };
}

/** Remplace la mention partielle par @username suivi d'un espace. */
export function insertStoryMention(
  text: string,
  start: number,
  end: number,
  username: string
): { text: string; cursor: number } {
  const mention = `@${username} `;
  const next = text.slice(0, start) + mention + text.slice(end);
  return { text: next, cursor: start + mention.length };
}

/** Décale verticalement les tags créés depuis le même overlay texte (outil Taguer). */
export function mentionTagPosition(
  overlayX: number,
  overlayY: number,
  tagIndexAtOverlay: number
): { x: number; y: number } {
  return {
    x: overlayX,
    y: Math.min(0.92, overlayY + tagIndexAtOverlay * 0.055),
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Vérifie que @username apparaît encore dans le texte (mot complet). */
export function textContainsMention(text: string, username: string): boolean {
  const escaped = escapeRegExp(username);
  const re = new RegExp(`(?:^|[\\s])@${escaped}(?=[\\s.,;:!?]|$)`, 'i');
  return re.test(text);
}

/** Conserve uniquement les refs dont le @username est encore présent dans le texte. */
export function syncOverlayMentionRefs(
  text: string,
  refs: StoryTextMentionRef[] | undefined
): StoryTextMentionRef[] {
  if (!refs?.length) return [];
  return refs.filter((ref) => textContainsMention(text, ref.username));
}

/** Ajoute une ref de mention inline (sans doublon d'id). */
export function appendOverlayMentionRef(
  refs: StoryTextMentionRef[] | undefined,
  hit: StoryTextMentionRef
): StoryTextMentionRef[] {
  const current = refs ?? [];
  if (current.some((r) => r.id === hit.id)) return current;
  return [...current, { id: hit.id, username: hit.username }];
}

/** Collecte les mentions inline actives sur tous les calques texte. */
export function collectMentionRefsFromOverlays(
  overlays: TextOverlayMentionSource[]
): StoryTextMentionRef[] {
  const seen = new Set<string>();
  const out: StoryTextMentionRef[] = [];
  for (const o of overlays) {
    for (const ref of syncOverlayMentionRefs(o.text ?? '', o.mentionRefs)) {
      if (!seen.has(ref.id)) {
        seen.add(ref.id);
        out.push(ref);
      }
    }
  }
  return out;
}

/** Nombre total de personnes taguées (stickers + mentions inline), sans doublon. */
export function countUniqueTaggedUsers(
  stickerTags: Array<{ id: string }>,
  overlays: TextOverlayMentionSource[]
): number {
  const ids = new Set<string>();
  stickerTags.forEach((t) => ids.add(t.id));
  collectMentionRefsFromOverlays(overlays).forEach((r) => ids.add(r.id));
  return ids.size;
}

/** Tous les ids tagués (stickers + mentions inline) pour autocomplete / limite. */
export function collectAllTaggedUserIds(
  stickerTags: Array<{ id: string }>,
  overlays: TextOverlayMentionSource[]
): string[] {
  const ids = new Set<string>();
  stickerTags.forEach((t) => ids.add(t.id));
  collectMentionRefsFromOverlays(overlays).forEach((r) => ids.add(r.id));
  return [...ids];
}

/** Stickers @ séparés : exclut ceux déjà mentionnés dans un texte (évite double rendu). */
export function filterStickerTagsNotInText(
  stickerTags: StoryTaggedUser[],
  overlays: TextOverlayMentionSource[]
): StoryTaggedUser[] {
  const mentionedInText = new Set(
    collectMentionRefsFromOverlays(overlays).map((r) => r.id)
  );
  return stickerTags.filter((t) => !mentionedInText.has(t.id));
}

/** Fusionne stickers Taguer + mentions inline pour l'export API (taggedUserIds). */
export function mergeTaggedUsersForExport(
  stickerTags: StoryTaggedUser[],
  overlays: TextOverlayMentionSource[]
): StoryTaggedUser[] {
  const byId = new Map<string, StoryTaggedUser>();
  for (const t of stickerTags) {
    byId.set(t.id, t);
  }
  for (const ref of collectMentionRefsFromOverlays(overlays)) {
    if (!byId.has(ref.id)) {
      byId.set(ref.id, { id: ref.id, username: ref.username });
    }
  }
  return [...byId.values()];
}
