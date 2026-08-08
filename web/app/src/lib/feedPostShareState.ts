const STORAGE_KEY = 'onscen_feed_link_shared';

function readIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === 'string' && id.length > 0));
  } catch {
    return new Set();
  }
}

/** Post IDs for which the user completed an external share (link menu). */
export function readFeedPostLinkSharedIds(): Set<string> {
  return readIds();
}

export function markFeedPostLinkShared(postId: string): void {
  try {
    const ids = readIds();
    if (ids.has(postId)) return;
    ids.add(postId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}
