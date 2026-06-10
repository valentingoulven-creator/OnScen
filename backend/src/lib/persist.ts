import fs from 'fs';
import path from 'path';
import { getMsdevEnvPath } from '../paths';
import { isPostgresEnabled } from '../db/pool';
import {
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
    if (!isValidPersistedStore(raw)) return false;
    restoreStore(raw);
    return raw.users.length > 0;
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
      console.warn('[soundly] Échec sauvegarde PostgreSQL:', e);
    });
    return;
  }
  savePersistedStoreToFile();
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
      console.warn('[melosong] Échec sauvegarde:', e);
    }
  }, 800);
}

export function startPersistLoop(): void {
  if (persistInterval) return;
  persistInterval = setInterval(() => schedulePersist(), 30_000);
}

export async function stopPersistLoop(): Promise<void> {
  if (persistInterval) clearInterval(persistInterval);
  persistInterval = null;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  try {
    if (usesPostgresPersistence()) {
      await savePersistedStoreToPostgres();
    } else {
      savePersistedStoreToFile();
    }
  } catch {
    /* ignore */
  }
}
