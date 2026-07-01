import { db } from '../models/schema';

export const MAX_TAGGED_USERS = 5;

export interface PublicTaggedUser {
  id: string;
  username: string;
  avatarUrl?: string;
  usernameColor?: string;
  usernameWaveFrom?: string;
  usernameWaveTo?: string;
}

export function normalizeTaggedUserIds(raw: unknown, authorId: string): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const ids: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const id = item.trim();
    if (!id || id === authorId || ids.includes(id)) continue;
    if (!db.users.get(id)) continue;
    ids.push(id);
    if (ids.length >= MAX_TAGGED_USERS) break;
  }
  return ids.length ? ids : undefined;
}

export function resolveTaggedUsers(ids: string[] | undefined): PublicTaggedUser[] | undefined {
  if (!ids?.length) return undefined;
  const out: PublicTaggedUser[] = [];
  for (const id of ids) {
    const u = db.users.get(id);
    if (!u) continue;
    out.push({
      id: u.id,
      username: u.username,
      avatarUrl: u.avatarUrl,
      usernameColor: u.usernameColor,
      usernameWaveFrom: u.usernameWaveFrom,
      usernameWaveTo: u.usernameWaveTo,
    });
  }
  return out.length ? out : undefined;
}
