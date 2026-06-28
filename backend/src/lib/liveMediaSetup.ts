import type { User } from '../models/schema';

export type PersistedLiveChatConfig = {
  noLinksForParticipants?: boolean;
  slowModeSeconds?: number;
  subscribersOnly?: boolean;
};

export type PersistedLiveHostSessionDraft = {
  goals: Array<{ id: string; type: string; target: number; label: string }>;
  rewards: Array<Record<string, unknown>>;
};

/** Préférences live enregistrées par utilisateur (payload JSONB). */
export type PersistedLiveMediaSetup = {
  videoDeviceId?: string;
  audioDeviceId?: string;
  startLatitude?: number;
  startLongitude?: number;
  startLocationLabel?: string;
  startLocationSource?: 'my_position' | 'city' | 'address';
  liveTitle?: string;
  chatConfig?: PersistedLiveChatConfig;
  hostSessionDraft?: PersistedLiveHostSessionDraft;
  useObs?: boolean;
  configuredAt?: number;
};

function isFiniteCoord(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

export function sanitizeLiveMediaSetup(raw: unknown): PersistedLiveMediaSetup | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const setup: PersistedLiveMediaSetup = {};

  if (typeof o.videoDeviceId === 'string' && o.videoDeviceId.trim()) {
    setup.videoDeviceId = o.videoDeviceId.trim().slice(0, 256);
  }
  if (typeof o.audioDeviceId === 'string' && o.audioDeviceId.trim()) {
    setup.audioDeviceId = o.audioDeviceId.trim().slice(0, 256);
  }
  if (isFiniteCoord(o.startLatitude)) setup.startLatitude = o.startLatitude;
  if (isFiniteCoord(o.startLongitude)) setup.startLongitude = o.startLongitude;
  if (typeof o.startLocationLabel === 'string') {
    setup.startLocationLabel = o.startLocationLabel.trim().slice(0, 200);
  }
  if (o.startLocationSource === 'my_position' || o.startLocationSource === 'city' || o.startLocationSource === 'address') {
    setup.startLocationSource = o.startLocationSource;
  }
  if (typeof o.liveTitle === 'string' && o.liveTitle.trim()) {
    setup.liveTitle = o.liveTitle.trim().slice(0, 120);
  }
  if (typeof o.useObs === 'boolean') setup.useObs = o.useObs;

  if (o.chatConfig && typeof o.chatConfig === 'object') {
    const c = o.chatConfig as Record<string, unknown>;
    setup.chatConfig = {
      noLinksForParticipants: c.noLinksForParticipants === true,
      slowModeSeconds:
        typeof c.slowModeSeconds === 'number' && c.slowModeSeconds >= 0
          ? Math.min(300, Math.floor(c.slowModeSeconds))
          : 0,
      subscribersOnly: c.subscribersOnly === true,
    };
  }

  if (o.hostSessionDraft && typeof o.hostSessionDraft === 'object') {
    const h = o.hostSessionDraft as Record<string, unknown>;
    if (Array.isArray(h.goals) && Array.isArray(h.rewards)) {
      setup.hostSessionDraft = {
        goals: h.goals as PersistedLiveHostSessionDraft['goals'],
        rewards: h.rewards as PersistedLiveHostSessionDraft['rewards'],
      };
    }
  }

  if (typeof o.configuredAt === 'number' && Number.isFinite(o.configuredAt)) {
    setup.configuredAt = o.configuredAt;
  }

  return setup;
}

export function getUserLiveMediaSetup(user: User): PersistedLiveMediaSetup | null {
  const setup = sanitizeLiveMediaSetup(user.liveMediaSetup);
  if (!setup?.configuredAt) return null;
  return setup;
}

export function isLiveMediaSetupConfigured(user: User): boolean {
  return getUserLiveMediaSetup(user) != null;
}

export function saveUserLiveMediaSetup(user: User, raw: unknown): PersistedLiveMediaSetup {
  const setup = sanitizeLiveMediaSetup(raw) ?? {};
  setup.configuredAt = Date.now();
  user.liveMediaSetup = setup;
  return setup;
}
