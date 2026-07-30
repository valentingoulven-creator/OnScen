/** Client-side salon session — survives tab switches and brief remounts (sessionStorage). */

export type SalonViewMode = 'full' | 'minimized';

export type ActiveSalonSession = {
  id: string;
  title?: string;
  /** Grand salon plein écran vs fiche carte / autre onglet. */
  viewMode?: SalonViewMode;
  /** L'utilisateur courant est l'hôte de ce salon. */
  isHost?: boolean;
};

const STORAGE_KEY = 'soundy.activeSalonSession';

export function readPersistedSalonSession(): ActiveSalonSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveSalonSession;
    if (!parsed?.id || typeof parsed.id !== 'string') return null;
    const viewMode =
      parsed.viewMode === 'full' || parsed.viewMode === 'minimized' ? parsed.viewMode : undefined;
    const isHost =
      parsed.isHost === true ? true : parsed.isHost === false ? false : undefined;
    // The PiP float state is held in memory only and is lost on page refresh.
    // A minimised session is therefore restored as full-screen so the YouTube
    // theater reopens automatically — the user can minimise again if needed.
    const restoredViewMode = viewMode === 'minimized' ? 'full' : viewMode;
    return { id: parsed.id, title: parsed.title, viewMode: restoredViewMode, isHost };
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
