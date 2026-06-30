import type { GoalType, LiveReward } from './liveHostTypes';

export interface LiveHostSessionDraft {
  goals: Array<{
    id: string;
    type: GoalType;
    target: number;
    label: string;
  }>;
  rewards: LiveReward[];
}

export interface LiveMediaPrefs {
  videoDeviceId?: string;
  audioDeviceId?: string;
  /** Résolution vidéo live (1080p par défaut). */
  videoResolution?: import('./liveVideoResolution').LiveVideoResolutionPreset;
  /** Format d'image (16:9 Twitch par défaut). */
  videoAspectRatio?: import('./liveVideoAspectRatio').LiveVideoAspectRatioPreset;
  /** msdev/dev — entrer en live hôte sans getUserMedia (UI salon / théâtre). */
  demoNoMedia?: boolean;
  /** Position du live au démarrage (carte). */
  startLatitude?: number;
  startLongitude?: number;
  startLocationLabel?: string;
  startLocationSource?: 'my_position' | 'city' | 'address';
  /** Titre affiché du live au démarrage. */
  liveTitle?: string;
  /** Modération chat appliquée dès l'ouverture du live. */
  chatConfig?: {
    noLinksForParticipants?: boolean;
    slowModeSeconds?: number;
    subscribersOnly?: boolean;
  };
  /** Goals et menu récompenses configurés avant le live. */
  hostSessionDraft?: LiveHostSessionDraft;
  /** Diffusion OBS (RTMP Cloudflare) — pas de caméra navigateur au démarrage. */
  useObs?: boolean;
  /** Type de contenu du live (musique, danse, artistique). */
  contentCategory?: import('./liveContentCategory').LiveContentCategory;
  /** Délai vidéo spectateurs (secondes) — 0 = temps réel. */
  videoDelaySeconds?: number;
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

/** Retire chatConfig des prefs après application sur le live ouvert. */
export function clearLiveChatConfigFromPrefs(): void {
  const prefs = getLiveMediaPrefs();
  if (!prefs?.chatConfig) return;
  const { chatConfig: _removed, ...rest } = prefs;
  setLiveMediaPrefs(rest);
}

/** Retire hostSessionDraft des prefs après application sur le live ouvert. */
export function clearHostSessionDraftFromPrefs(): void {
  const prefs = getLiveMediaPrefs();
  if (!prefs?.hostSessionDraft) return;
  const { hostSessionDraft: _removed, ...rest } = prefs;
  setLiveMediaPrefs(rest);
}

/** Retire useObs des prefs après ouverture du live en mode OBS. */
export function clearUseObsFromPrefs(): void {
  const prefs = getLiveMediaPrefs();
  if (!prefs?.useObs) return;
  const { useObs: _removed, ...rest } = prefs;
  setLiveMediaPrefs(rest);
}
