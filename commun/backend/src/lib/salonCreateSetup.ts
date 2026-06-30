import type { User } from '../models/schema';

/** Préférences création salon enregistrées par utilisateur (payload JSONB). */
export type PersistedSalonCreateSetup = {
  title?: string;
  accessMode?: 'public' | 'invite';
  allowQueue?: boolean;
  genres?: string[];
  startLatitude?: number;
  startLongitude?: number;
  startLocationLabel?: string;
  startLocationSource?: 'my_position' | 'city' | 'address';
  configuredAt?: number;
};

function isFiniteCoord(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

export function sanitizeSalonCreateSetup(raw: unknown): PersistedSalonCreateSetup | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const setup: PersistedSalonCreateSetup = {};

  if (typeof o.title === 'string' && o.title.trim()) {
    setup.title = o.title.trim().slice(0, 120);
  }
  if (o.accessMode === 'public' || o.accessMode === 'invite') {
    setup.accessMode = o.accessMode;
  }
  if (typeof o.allowQueue === 'boolean') {
    setup.allowQueue = o.allowQueue;
  }
  if (Array.isArray(o.genres)) {
    setup.genres = o.genres
      .filter((g): g is string => typeof g === 'string' && g.trim().length > 0)
      .map((g) => g.trim().slice(0, 80))
      .slice(0, 10);
  }
  if (isFiniteCoord(o.startLatitude)) setup.startLatitude = o.startLatitude;
  if (isFiniteCoord(o.startLongitude)) setup.startLongitude = o.startLongitude;
  if (typeof o.startLocationLabel === 'string') {
    setup.startLocationLabel = o.startLocationLabel.trim().slice(0, 200);
  }
  if (
    o.startLocationSource === 'my_position' ||
    o.startLocationSource === 'city' ||
    o.startLocationSource === 'address'
  ) {
    setup.startLocationSource = o.startLocationSource;
  }
  if (typeof o.configuredAt === 'number' && Number.isFinite(o.configuredAt)) {
    setup.configuredAt = o.configuredAt;
  }

  return setup;
}

export function getUserSalonCreateSetup(user: User): PersistedSalonCreateSetup | null {
  const setup = sanitizeSalonCreateSetup(user.salonCreateSetup);
  if (!setup?.configuredAt) return null;
  return setup;
}

export function isSalonCreateSetupConfigured(user: User): boolean {
  return getUserSalonCreateSetup(user) != null;
}

export function saveUserSalonCreateSetup(user: User, raw: unknown): PersistedSalonCreateSetup {
  const setup = sanitizeSalonCreateSetup(raw) ?? {};
  setup.configuredAt = Date.now();
  user.salonCreateSetup = setup;
  return setup;
}
