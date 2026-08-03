import type { MapStory } from '../types';
import type { MapStoryEntry } from './mapStoriesFeed';

export const STORY_VIEW_DURATION_MS = 5000;

/** Aperçu live depuis le bandeau stories avant passage automatique au segment suivant. */
export const STORY_LIVE_PREVIEW_DURATION_MS = 10_000;

export interface StoryUserStack {
  userId: string;
  stories: MapStory[];
}

/** Ordre chronologique (plus ancienne → plus récente) pour la pile visionneuse. */
export function sortStoriesChronological(stories: MapStory[]): MapStory[] {
  return [...stories].sort((a, b) => a.createdAt - b.createdAt);
}

export function latestStory(stories: MapStory[]): MapStory | undefined {
  const sorted = sortStoriesChronological(stories);
  return sorted[sorted.length - 1];
}

/** Regroupe les stories actives par utilisateur (ordre chronologique dans chaque pile). */
export function groupStoriesByUser(stories: MapStory[]): Map<string, MapStory[]> {
  const map = new Map<string, MapStory[]>();
  for (const story of stories) {
    const list = map.get(story.userId) ?? [];
    list.push(story);
    map.set(story.userId, list);
  }
  for (const [userId, list] of map) {
    map.set(userId, sortStoriesChronological(list));
  }
  return map;
}

export function areAllStoriesSeen(stories: MapStory[], seenIds: Set<string>): boolean {
  return stories.length > 0 && stories.every((s) => seenIds.has(s.id));
}

/** Première story de la pile (lecture depuis le début, re-regardable). */
export function pickInitialStory(stories: MapStory[]): MapStory | undefined {
  const sorted = sortStoriesChronological(stories);
  return sorted[0];
}

/** Retire les IDs expirés/absents du set « vu » local. */
export function pruneSeenStoryIds(seenIds: Set<string>, activeIds: Iterable<string>): Set<string> {
  const active = new Set(activeIds);
  const next = new Set<string>();
  for (const id of seenIds) {
    if (active.has(id)) next.add(id);
  }
  return next.size === seenIds.size ? seenIds : next;
}

/** Piles de stories par utilisateur (ordre bandeau : ma story puis entrées). */
export function buildStoryUserStacks(
  entries: MapStoryEntry[],
  storiesByUser: Map<string, MapStory[]>,
  myStories?: MapStory[] | null
): StoryUserStack[] {
  const stacks: StoryUserStack[] = [];
  if (myStories?.length) {
    stacks.push({ userId: myStories[0]!.userId, stories: sortStoriesChronological(myStories) });
  }
  for (const entry of entries) {
    if (!entry.hasActiveStory || !entry.storyId) continue;
    const userStories = storiesByUser.get(entry.userId);
    if (userStories?.length) stacks.push({ userId: entry.userId, stories: userStories });
  }
  return stacks;
}

export function findStackForStory(stacks: StoryUserStack[], story: MapStory): StoryUserStack | undefined {
  return stacks.find((s) => s.userId === story.userId);
}

export function stackIndexForStory(stack: StoryUserStack, story: MapStory): number {
  const idx = stack.stories.findIndex((s) => s.id === story.id);
  return idx >= 0 ? idx : 0;
}

export interface StoryNavResult {
  story: MapStory;
  isOwn: boolean;
}

/** Story suivante : segment suivant dans la pile, sinon premier segment de l'utilisateur suivant. */
export function resolveNextStory(
  stacks: StoryUserStack[],
  current: MapStory,
  viewerUserId?: string
): StoryNavResult | null {
  const stack = findStackForStory(stacks, current);
  if (!stack) return null;
  const idx = stackIndexForStory(stack, current);
  if (idx < stack.stories.length - 1) {
    const story = stack.stories[idx + 1]!;
    return { story, isOwn: story.userId === viewerUserId };
  }
  const stackIdx = stacks.findIndex((s) => s.userId === current.userId);
  if (stackIdx < 0 || stackIdx >= stacks.length - 1) return null;
  const nextStack = stacks[stackIdx + 1]!;
  const story = nextStack.stories[0]!;
  return { story, isOwn: story.userId === viewerUserId };
}

/** Story précédente : segment précédent dans la pile, sinon dernier segment de l'utilisateur précédent. */
export function resolvePrevStory(
  stacks: StoryUserStack[],
  current: MapStory,
  viewerUserId?: string
): StoryNavResult | null {
  const stack = findStackForStory(stacks, current);
  if (!stack) return null;
  const idx = stackIndexForStory(stack, current);
  if (idx > 0) {
    const story = stack.stories[idx - 1]!;
    return { story, isOwn: story.userId === viewerUserId };
  }
  const stackIdx = stacks.findIndex((s) => s.userId === current.userId);
  if (stackIdx <= 0) return null;
  const prevStack = stacks[stackIdx - 1]!;
  const story = prevStack.stories[prevStack.stories.length - 1]!;
  return { story, isOwn: story.userId === viewerUserId };
}

export type StoryAfterDeleteNav =
  | { action: 'close' }
  | { action: 'view'; story: MapStory; isOwn: boolean };

/** Après suppression : story suivante dans la pile, autre pile, ou fermeture. */
export function resolveAfterStoryDeleted(
  stacks: StoryUserStack[],
  deleted: MapStory,
  viewerUserId?: string
): StoryAfterDeleteNav {
  const stack = findStackForStory(stacks, deleted);
  if (!stack) return { action: 'close' };
  const idx = stackIndexForStory(stack, deleted);
  const remaining = stack.stories.filter((s) => s.id !== deleted.id);

  if (remaining.length > 0) {
    const nextIdx = Math.min(idx, remaining.length - 1);
    const story = remaining[nextIdx]!;
    return { action: 'view', story, isOwn: story.userId === viewerUserId };
  }

  const updatedStacks = stacks
    .map((s) => ({ ...s, stories: s.stories.filter((st) => st.id !== deleted.id) }))
    .filter((s) => s.stories.length > 0);
  if (updatedStacks.length === 0) return { action: 'close' };

  const stackIdx = stacks.findIndex((s) => s.userId === deleted.userId);
  if (stackIdx < updatedStacks.length) {
    const nextStack = updatedStacks[stackIdx]!;
    const story = nextStack.stories[0]!;
    return { action: 'view', story, isOwn: story.userId === viewerUserId };
  }
  if (stackIdx > 0) {
    const prevStack = updatedStacks[stackIdx - 1]!;
    const story = prevStack.stories[prevStack.stories.length - 1]!;
    return { action: 'view', story, isOwn: story.userId === viewerUserId };
  }
  const first = updatedStacks[0]!.stories[0]!;
  return { action: 'view', story: first, isOwn: first.userId === viewerUserId };
}

/** Après l’aperçu live : stories du même auteur, sinon prochain anneau (story ou live). */
export function resolveAfterLivePreview(
  entries: MapStoryEntry[],
  current: MapStoryEntry
):
  | { type: 'story'; entry: MapStoryEntry }
  | { type: 'live'; entry: MapStoryEntry }
  | { type: 'close' } {
  if (current.hasActiveStory && current.storyId) {
    return { type: 'story', entry: current };
  }
  const idx = entries.findIndex((e) => e.userId === current.userId);
  for (let i = idx + 1; i < entries.length; i++) {
    const e = entries[i]!;
    if (e.hasActiveStory && e.storyId) return { type: 'story', entry: e };
    if (e.isLive && e.liveId) return { type: 'live', entry: e };
  }
  return { type: 'close' };
}

/**
 * Après le dernier segment story d’un anneau : segment suivant dans l’ordre du bandeau
 * (live ou story), sans sauter les anneaux « live seul ».
 */
export function resolveNextAfterLastStorySegment(
  entries: MapStoryEntry[],
  storiesByUser: Map<string, MapStory[]>,
  userId: string,
  viewerUserId?: string
):
  | { kind: 'story'; story: MapStory; isOwn: boolean }
  | { kind: 'live'; entry: MapStoryEntry; liveId: string }
  | null {
  const entryIdx = entries.findIndex((e) => e.userId === userId);
  if (entryIdx < 0) return null;

  for (let i = entryIdx + 1; i < entries.length; i++) {
    const e = entries[i]!;
    if (e.hasActiveStory && e.storyId) {
      const list = storiesByUser.get(e.userId);
      const story = list?.length ? pickInitialStory(list) : undefined;
      if (story) {
        return { kind: 'story', story, isOwn: story.userId === viewerUserId };
      }
    }
    if (e.isLive && e.liveId) {
      return { kind: 'live', entry: e, liveId: e.liveId };
    }
  }
  return null;
}

/** Anneau précédent dans le bandeau (story ou live). */
export function resolveBeforeLivePreview(
  entries: MapStoryEntry[],
  current: MapStoryEntry
):
  | { type: 'story'; entry: MapStoryEntry }
  | { type: 'live'; entry: MapStoryEntry }
  | { type: 'close' } {
  const idx = entries.findIndex((e) => e.userId === current.userId);
  if (idx <= 0) return { type: 'close' };
  for (let i = idx - 1; i >= 0; i--) {
    const e = entries[i]!;
    if (e.hasActiveStory && e.storyId) return { type: 'story', entry: e };
    if (e.isLive && e.liveId) return { type: 'live', entry: e };
  }
  return { type: 'close' };
}

export function formatStoryTimeAgo(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return "À l'instant";
  const min = Math.floor(sec / 60);
  if (min < 60) return `Il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `Il y a ${d} j`;
  return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
