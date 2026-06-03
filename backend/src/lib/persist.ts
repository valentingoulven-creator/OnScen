import fs from 'fs';
import path from 'path';
import {
  db,
  type ChatMessage,
  type DirectMessage,
  type LiveBan,
  type User,
  type UserBlock,
} from '../models/schema';
import { getMsdevEnvPath } from '../paths';

function getStorePath(): string {
  const envDir = path.dirname(getMsdevEnvPath());
  return path.join(envDir, 'data', 'store.json');
}

type MapOfSets = Record<string, string[]>;

interface PersistedStore {
  version: 1;
  savedAt: number;
  users: User[];
  directMessages: DirectMessage[];
  salonChats: Record<string, ChatMessage[]>;
  liveChats: Record<string, ChatMessage[]>;
  liveBans: { liveId: string; userId: string; ban: LiveBan }[];
  userBlocks: UserBlock[];
  userFollows: MapOfSets;
}

function recordToMap<V>(record: Record<string, V> | undefined): Map<string, V> {
  const map = new Map<string, V>();
  if (!record) return map;
  for (const [k, v] of Object.entries(record)) map.set(k, v);
  return map;
}

function setsToRecord(map: Map<string, Set<string>>): MapOfSets {
  const out: MapOfSets = {};
  for (const [k, set] of map.entries()) out[k] = [...set];
  return out;
}

function recordToSets(record: MapOfSets | undefined): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  if (!record) return map;
  for (const [k, arr] of Object.entries(record)) map.set(k, new Set(arr));
  return map;
}

function snapshot(): PersistedStore {
  const salonChats: Record<string, ChatMessage[]> = {};
  for (const [id, list] of db.salonChats.entries()) salonChats[id] = list ?? [];

  const liveChats: Record<string, ChatMessage[]> = {};
  for (const [id, list] of db.liveChats.entries()) liveChats[id] = list ?? [];

  const liveBans: PersistedStore['liveBans'] = [];
  for (const [liveId, bans] of db.liveBans.entries()) {
    for (const [userId, ban] of bans.entries()) liveBans.push({ liveId, userId, ban });
  }

  return {
    version: 1,
    savedAt: Date.now(),
    users: [...db.users.values()],
    directMessages: [...db.directMessages],
    salonChats,
    liveChats,
    liveBans,
    userBlocks: [...db.userBlocks],
    userFollows: setsToRecord(db.userFollows),
  };
}

function restore(data: PersistedStore): void {
  db.users.clear();
  for (const u of data.users) db.users.set(u.id, u);

  db.directMessages.length = 0;
  db.directMessages.push(...data.directMessages);

  db.salonChats.clear();
  for (const [id, list] of Object.entries(data.salonChats ?? {})) {
    db.salonChats.set(id, list);
  }

  db.liveChats.clear();
  for (const [id, list] of Object.entries(data.liveChats ?? {})) {
    db.liveChats.set(id, list);
  }

  db.liveBans.clear();
  for (const { liveId, userId, ban } of data.liveBans ?? []) {
    if (!db.liveBans.has(liveId)) db.liveBans.set(liveId, new Map());
    db.liveBans.get(liveId)!.set(userId, ban);
  }

  db.userBlocks.length = 0;
  db.userBlocks.push(...(data.userBlocks ?? []));

  db.userFollows.clear();
  for (const [k, arr] of Object.entries(data.userFollows ?? {})) {
    db.userFollows.set(k, new Set(arr));
  }
}

export function loadPersistedStore(): boolean {
  const file = getStorePath();
  if (!fs.existsSync(file)) return false;
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as PersistedStore;
    if (raw.version !== 1 || !Array.isArray(raw.users)) return false;
    restore(raw);
    return db.users.size > 0;
  } catch {
    return false;
  }
}

export function savePersistedStore(): void {
  const file = getStorePath();
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(snapshot(), null, 2), 'utf-8');
  fs.renameSync(tmp, file);
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let persistInterval: ReturnType<typeof setInterval> | null = null;

export function schedulePersist(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      savePersistedStore();
    } catch (e) {
      console.warn('[melosong] Échec sauvegarde locale:', e);
    }
  }, 800);
}

export function startPersistLoop(): void {
  if (persistInterval) return;
  persistInterval = setInterval(() => schedulePersist(), 30_000);
}

export function stopPersistLoop(): void {
  if (persistInterval) clearInterval(persistInterval);
  persistInterval = null;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  try {
    savePersistedStore();
  } catch {
    /* ignore */
  }
}
