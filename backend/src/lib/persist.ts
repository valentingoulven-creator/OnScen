import fs from 'fs';
import path from 'path';
import { getMsdevEnvPath } from '../paths';
import { isPostgresEnabled } from '../db/pool';
import {
  filterValidUsers,
  isValidPersistedStore,
  restoreStore,
  snapshotStore,
  type PersistedStore,
} from './storeCore';
import {
  loadPersistedStoreFromPostgres,
  savePersistedStoreToPostgres,
} from './pgStore';

function getStorePath(): string {
  const envDir = path.dirname(getMsdevEnvPath());
  return path.join(envDir, 'data', 'store.json');
}

export function usesPostgresPersistence(): boolean {
  return isPostgresEnabled();
}

function loadPersistedStoreFromFile(): boolean {
  const file = getStorePath();
  if (!fs.existsSync(file)) return false;
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as PersistedStore;
    if (!raw || typeof raw !== 'object' || raw.version !== 1) return false;
    const { valid: users, skippedIds } = filterValidUsers(raw.users ?? []);
    if (skippedIds.length > 0) {
      console.warn(
        `[persist] ${skippedIds.length} utilisateur(s) ignoré(s) à la lecture store.json`
      );
    }
    const sanitized: PersistedStore = { ...raw, users };
    if (!isValidPersistedStore(sanitized)) return false;
    restoreStore(sanitized);
    return users.length > 0;
  } catch {
    return false;
  }
}

function savePersistedStoreToFile(): void {
  const file = getStorePath();
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(snapshotStore(), null, 2), 'utf-8');
  fs.renameSync(tmp, file);
}

export function loadPersistedStore(): boolean {
  if (usesPostgresPersistence()) {
    throw new Error('loadPersistedStore() est synchrone — utilisez loadPersistedStoreAsync() en production PostgreSQL');
  }
  return loadPersistedStoreFromFile();
}

export async function loadPersistedStoreAsync(): Promise<boolean> {
  if (usesPostgresPersistence()) {
    return loadPersistedStoreFromPostgres();
  }
  return loadPersistedStoreFromFile();
}

export function savePersistedStore(): void {
  if (usesPostgresPersistence()) {
    void savePersistedStoreToPostgres().catch((e) => {
      console.error('[soundy] Échec sauvegarde PostgreSQL:', e);
    });
    return;
  }
  try {
    savePersistedStoreToFile();
  } catch (e) {
    console.error('[soundy] Échec sauvegarde store.json:', e);
    throw e;
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let persistInterval: ReturnType<typeof setInterval> | null = null;
let storeDirty = false;

export function isStoreDirty(): boolean {
  return storeDirty;
}

export function schedulePersist(): void {
  storeDirty = true;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    flushPersistIfDirty();
  }, 800);
}

function flushPersistIfDirty(force = false): void {
  if (!force && !storeDirty) return;
  try {
    savePersistedStore();
    storeDirty = false;
  } catch (e) {
    console.error('[melosong] Échec sauvegarde planifiée:', e);
  }
}

// Fix #5: intervalle 10 s — ne flush que si le store a changé (évite DELETE+INSERT PG inutiles).
export function startPersistLoop(): void {
  if (persistInterval) return;
  persistInterval = setInterval(() => flushPersistIfDirty(), 10_000);
}

export async function stopPersistLoop(): Promise<void> {
  if (persistInterval) clearInterval(persistInterval);
  persistInterval = null;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  storeDirty = true;
  try {
    if (usesPostgresPersistence()) {
      await savePersistedStoreToPostgres();
    } else {
      savePersistedStoreToFile();
    }
    storeDirty = false;
  } catch (e) {
    console.error('[melosong] Échec sauvegarde finale à l’arrêt:', e);
  }
}
