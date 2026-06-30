import { db } from '../models/schema';
import { normalizeGlobalSearchQuery } from './globalSearch';

type IndexedUser = { id: string; normalized: string; username: string };

let usernameIndex: IndexedUser[] | null = null;

function rebuildUsernameIndex(): IndexedUser[] {
  const next: IndexedUser[] = [];
  for (const u of db.users.values()) {
    if (u.isGhostMode) continue;
    next.push({
      id: u.id,
      normalized: normalizeGlobalSearchQuery(u.username),
      username: u.username,
    });
  }
  next.sort((a, b) => a.username.localeCompare(b.username, 'fr'));
  usernameIndex = next;
  return next;
}

export function invalidateGlobalSearchIndex(): void {
  usernameIndex = null;
}

/** Prefix/substring search on usernames without scanning the full user map each keystroke. */
export function searchUsernamesInIndex(
  viewerId: string,
  q: string,
  limit: number
): IndexedUser[] {
  const normalizedQ = normalizeGlobalSearchQuery(q);
  if (normalizedQ.length < 2) return [];
  const index = usernameIndex ?? rebuildUsernameIndex();
  const hits: IndexedUser[] = [];
  for (const row of index) {
    if (row.id === viewerId) continue;
    if (!row.normalized.includes(normalizedQ)) continue;
    hits.push(row);
    if (hits.length >= limit * 3) break;
  }
  return hits.slice(0, limit);
}
