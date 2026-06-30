/** Client-side live viewer/host session — survives tab switches while PiP is active. */

export type LiveViewMode = 'full' | 'minimized';

export type ActiveLiveViewerSession = {
  id: string;
  title?: string;
  viewMode?: LiveViewMode;
  /** L'utilisateur courant diffuse ce live. */
  isHost?: boolean;
};

const STORAGE_KEY = 'soundy.activeLiveViewerSession';

export function readPersistedLiveViewerSession(): ActiveLiveViewerSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveLiveViewerSession;
    if (!parsed?.id || typeof parsed.id !== 'string') return null;
    const viewMode =
      parsed.viewMode === 'full' || parsed.viewMode === 'minimized' ? parsed.viewMode : undefined;
    const isHost = parsed.isHost === true ? true : undefined;
    const restoredViewMode = viewMode === 'minimized' ? 'full' : viewMode;
    return { id: parsed.id, title: parsed.title, viewMode: restoredViewMode, isHost };
  } catch {
    return null;
  }
}

export function writePersistedLiveViewerSession(session: ActiveLiveViewerSession | null): void {
  try {
    if (!session) {
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* private mode / quota */
  }
}

export function clearPersistedLiveViewerSession(): void {
  writePersistedLiveViewerSession(null);
}
