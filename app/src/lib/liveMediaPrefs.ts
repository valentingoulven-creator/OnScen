export interface LiveMediaPrefs {
  videoDeviceId?: string;
  audioDeviceId?: string;
}

const STORAGE_KEY = 'melosong_live_media_prefs';
const PENDING_CAMERA_START_KEY = 'melosong_live_pending_camera_start';

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

/** Set after pre-live camera setup so LivePage auto-starts the host camera. */
export function setPendingLiveCameraStart(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(PENDING_CAMERA_START_KEY, '1');
  } catch {
    /* quota / mode privé */
  }
}

export function hasPendingLiveCameraStart(): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  try {
    return sessionStorage.getItem(PENDING_CAMERA_START_KEY) === '1';
  } catch {
    return false;
  }
}

export function clearPendingLiveCameraStart(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(PENDING_CAMERA_START_KEY);
  } catch {
    /* ignore */
  }
}
