import { describe, it, expect, beforeEach } from 'vitest';
import { db, Salon, User } from '../models/schema';
import { canJoinSalon, isSalonPublic, isSalonVisibleOnMap, isSalonVisibleOnProfile } from './salonAccess';

function seedUser(id: string, opts?: Partial<User>): User {
  const user: User = {
    id,
    username: opts?.username ?? id,
    email: `${id}@test.local`,
    passwordHash: 'hash',
    meloCoins: 0,
    isGhostMode: false,
    city: 'Paris',
    latitude: 48.8566,
    longitude: 2.3522,
    lastSeenAt: Date.now(),
    accountStatus: 'active',
    ...opts,
  };
  db.users.set(id, user);
  return user;
}

function seedSalon(
  hostId: string,
  opts?: Partial<Salon>
): Salon {
  const salon: Salon = {
    id: opts?.id ?? `salon_${hostId}`,
    hostId,
    hostName: 'Host',
    title: 'Salon test',
    platform: 'spotify',
    playbackState: {
      platform: 'spotify',
      trackId: 'x',
      title: 'Track',
      artist: 'Artist',
      isPlaying: true,
      progressMs: 0,
      updatedAt: Date.now(),
    },
    latitude: 48.8566,
    longitude: 2.3522,
    blurredLatitude: 48.85,
    blurredLongitude: 2.35,
    listenersCount: 0,
    isGhostMode: false,
    isPublic: true,
    accessMode: 'public',
    allowedUserIds: [hostId],
    allowQueue: true,
    createdAt: Date.now(),
    ...opts,
  };
  db.salons.set(salon.id, salon);
  return salon;
}

describe('isSalonPublic', () => {
  it('normalise accessMode legacy via isPublic', () => {
    const salon = seedSalon('host', { accessMode: undefined, isPublic: true });
    expect(isSalonPublic(salon)).toBe(true);
  });
});

describe('isSalonVisibleOnProfile', () => {
  beforeEach(() => {
    db.users.clear();
    db.salons.clear();
  });

  it('affiche un salon public aux visiteurs', () => {
    const salon = seedSalon('host', { accessMode: 'public', isPublic: true });
    expect(isSalonVisibleOnProfile(salon, { isOwner: false })).toBe(true);
    expect(isSalonVisibleOnProfile(salon, { isOwner: true })).toBe(true);
  });

  it('masque un salon invite aux visiteurs du profil', () => {
    const salon = seedSalon('host', { accessMode: 'invite', isPublic: false });
    expect(isSalonVisibleOnProfile(salon, { isOwner: false })).toBe(false);
    expect(isSalonVisibleOnProfile(salon, { isOwner: true })).toBe(true);
  });
});

describe('isSalonVisibleOnMap', () => {
  beforeEach(() => {
    db.users.clear();
    db.salons.clear();
  });

  it('affiche un salon public à tout utilisateur connecté', () => {
    seedUser('host');
    seedUser('viewer');
    const salon = seedSalon('host', { accessMode: 'public', isPublic: true });
    expect(isSalonVisibleOnMap(salon, 'viewer')).toBe(true);
    expect(isSalonVisibleOnMap(salon, 'host')).toBe(true);
  });

  it('masque un salon invite sur la carte (même hôte et invités)', () => {
    seedUser('host');
    seedUser('viewer');
    seedUser('guest');
    const salon = seedSalon('host', {
      accessMode: 'invite',
      isPublic: false,
      allowedUserIds: ['host', 'guest'],
    });
    expect(isSalonVisibleOnMap(salon, 'guest')).toBe(false);
    expect(isSalonVisibleOnMap(salon, 'host')).toBe(false);
    expect(isSalonVisibleOnMap(salon, 'viewer')).toBe(false);
    expect(canJoinSalon(salon, 'guest')).toBe(true);
    expect(canJoinSalon(salon, 'viewer')).toBe(false);
  });

  it('masque ghost et adminBlocked pour le public', () => {
    seedUser('host');
    seedUser('viewer');
    const ghost = seedSalon('host', { id: 'ghost', isGhostMode: true });
    const blocked = seedSalon('host', { id: 'blocked', adminBlocked: true });
    expect(isSalonVisibleOnMap(ghost, 'viewer')).toBe(false);
    expect(isSalonVisibleOnMap(blocked, 'viewer')).toBe(false);
  });

  it('masque si l’hôte est en mode fantôme', () => {
    seedUser('host', { isGhostMode: true });
    seedUser('viewer');
    const salon = seedSalon('host', { isGhostMode: false });
    expect(isSalonVisibleOnMap(salon, 'viewer')).toBe(false);
  });

  it('dev voit tout', () => {
    seedUser('host');
    seedUser('dev', { isAdmin: true });
    const salon = seedSalon('host', {
      accessMode: 'invite',
      isPublic: false,
      allowedUserIds: ['host'],
      adminBlocked: true,
      isGhostMode: true,
    });
    expect(isSalonVisibleOnMap(salon, 'dev')).toBe(true);
    expect(canJoinSalon(salon, 'dev')).toBe(true);
  });
});
