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
      console.error('[soundly] Échec sauvegarde PostgreSQL:', e);
    });
    return;
  }
  try {
    savePersistedStoreToFile();
  } catch (e) {
    console.error('[soundly] Échec sauvegarde store.json:', e);
    throw e;
  }
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
      console.error('[melosong] Échec sauvegarde planifiée:', e);
    }
  }, 800);
}

// Fix #5: réduit de 30 s à 10 s pour limiter la perte de données (DMs, notifications).
// RISQUE DOCUMENTÉ : pgStore utilise encore DELETE+INSERT complet sur ~20 tables.
// Une refactorisation vers UPSERT par table est recommandée pour éliminer ce risque.
export function startPersistLoop(): void {
  if (persistInterval) return;
  persistInterval = setInterval(() => schedulePersist(), 10_000);
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
  } catch (e) {
    console.error('[melosong] Échec sauvegarde finale à l’arrêt:', e);
  }
}
