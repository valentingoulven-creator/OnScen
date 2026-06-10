import type { MapStory } from '../types';
import type { MapStoryEntry } from './mapStoriesFeed';

export const STORY_VIEW_DURATION_MS = 5000;

export interface StoryUserStack {
  userId: string;
  stories: MapStory[];
}

/** Piles de stories par utilisateur (ordre bandeau : ma story puis entrées). */
export function buildStoryUserStacks(
  entries: MapStoryEntry[],
  storiesByUser: Map<string, MapStory>,
  myStory?: MapStory | null
): StoryUserStack[] {
  const stacks: StoryUserStack[] = [];
  if (myStory) {
    stacks.push({ userId: myStory.userId, stories: [myStory] });
  }
  for (const entry of entries) {
    if (!entry.hasActiveStory || !entry.storyId) continue;
    const story = storiesByUser.get(entry.userId);
    if (story) stacks.push({ userId: entry.userId, stories: [story] });
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
