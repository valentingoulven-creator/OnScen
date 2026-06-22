export interface LiveMediaPrefs {
  videoDeviceId?: string;
  audioDeviceId?: string;
  /** msdev/dev — entrer en live hôte sans getUserMedia (UI salon / théâtre). */
  demoNoMedia?: boolean;
  /** Position du live au démarrage (carte). */
  startLatitude?: number;
  startLongitude?: number;
  startLocationLabel?: string;
  startLocationSource?: 'my_position' | 'city' | 'address';
}

const STORAGE_KEY = 'melosong_live_media_prefs';
const DRAFT_STORAGE_KEY = 'melosong_live_media_draft';
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

/** Pre-live setup draft — preserved when the modal is dismissed without starting. */
export function getLiveMediaDraft(): LiveMediaPrefs | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LiveMediaPrefs;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setLiveMediaDraft(prefs: LiveMediaPrefs): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* quota / mode privé */
  }
}

export function clearLiveMediaDraft(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(DRAFT_STORAGE_KEY);
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
