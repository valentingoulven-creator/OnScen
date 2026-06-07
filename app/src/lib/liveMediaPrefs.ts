export interface LiveMediaPrefs {
  videoDeviceId?: string;
  audioDeviceId?: string;
}

const STORAGE_KEY = 'melosong_live_media_prefs';

export function getLiveMediaPrefs(): LiveMediaPrefs | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LiveMediaPrefs;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setLiveMediaPrefs(prefs: LiveMediaPrefs): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* quota / mode privé */
  }
}

export function clearLiveMediaPrefs(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
