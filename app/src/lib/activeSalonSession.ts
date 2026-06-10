/** Client-side salon session — survives tab switches and brief remounts (sessionStorage). */

export type ActiveSalonSession = {
  id: string;
  title?: string;
};

const STORAGE_KEY = 'soundy.activeSalonSession';

export function readPersistedSalonSession(): ActiveSalonSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveSalonSession;
    if (!parsed?.id || typeof parsed.id !== 'string') return null;
    return { id: parsed.id, title: parsed.title };
  } catch {
    return null;
  }
}

export function writePersistedSalonSession(session: ActiveSalonSession | null): void {
  try {
    if (!session) {
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* private mode / quota — in-memory state still works */
  }
}

export function clearPersistedSalonSession(): void {
  writePersistedSalonSession(null);
}
