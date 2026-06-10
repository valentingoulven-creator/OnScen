import { describe, it, expect, beforeEach } from 'vitest';
import { db, Live, Salon, User } from '../models/schema';
import { buildTrendingUsers } from './trendingUsers';

function seedUser(id: string, username: string, city: string, lat: number, lon: number): User {
  const user: User = {
    id,
    username,
    email: `${id}@test.local`,
    passwordHash: 'hash',
    meloCoins: 0,
    isGhostMode: false,
    city,
    latitude: lat,
    longitude: lon,
    lastSeenAt: Date.now(),
    accountStatus: 'active',
  };
  db.users.set(id, user);
  return user;
}

function seedLive(host: User, viewers: number, lat: number, lon: number): Live {
  const live: Live = {
    id: `live_${host.id}`,
    hostId: host.id,
    hostName: host.username,
    title: 'Test live',
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
    latitude: lat,
    longitude: lon,
    blurredLatitude: lat,
    blurredLongitude: lon,
    viewersCount: viewers,
    isActive: true,
    startedAt: Date.now(),
  };
  db.lives.set(live.id, live);
  return live;
}

function seedSalon(host: User, listeners: number, lat: number, lon: number): Salon {
  const salon: Salon = {
    id: `salon_${host.id}`,
    hostId: host.id,
    hostName: host.username,
    title: 'Test salon',
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
    latitude: lat,
    longitude: lon,
    blurredLatitude: lat,
    blurredLongitude: lon,
    listenersCount: listeners,
    isGhostMode: false,
    isPublic: true,
    accessMode: 'public',
    allowedUserIds: [host.id],
    allowQueue: false,
    createdAt: Date.now(),
  };
  db.salons.set(salon.id, salon);
  return salon;
}

describe('buildTrendingUsers', () => {
  beforeEach(() => {
    db.users.clear();
    db.lives.clear();
    db.salons.clear();
    db.userFavorites.clear();
    db.userFollows.clear();
  });

  it('filtre les tendances par pays (FR vs BE)', () => {
    const parisLat = 48.8566;
    const parisLon = 2.3522;
    const brusselsLat = 50.8503;
    const brusselsLon = 4.3517;

    const frHost = seedUser('host_fr', 'Paris Host', 'Paris', parisLat, parisLon);
    const beHost = seedUser('host_be', 'Brussels Host', 'Brussels', brusselsLat, brusselsLon);
    seedLive(frHost, 30, parisLat, parisLon);
    seedLive(beHost, 20, brusselsLat, brusselsLon);

    const frTrends = buildTrendingUsers('FR');
    const beTrends = buildTrendingUsers('BE');

    expect(frTrends.map((u) => u.userId)).toEqual(['host_fr']);
    expect(beTrends.map((u) => u.userId)).toEqual(['host_be']);
    expect(frTrends[0].totalParticipants).toBe(30);
    expect(beTrends[0].totalParticipants).toBe(20);
  });

  it('agrège live et salon pour un même hôte', () => {
    const host = seedUser('host_fr', 'Paris Host', 'Paris', 48.8566, 2.3522);
    seedLive(host, 10, 48.8566, 2.3522);
    seedSalon(host, 5, 48.8566, 2.3522);

    const trends = buildTrendingUsers('FR');
    expect(trends[0].totalParticipants).toBe(15);
    expect(trends[0].liveCount).toBe(1);
    expect(trends[0].salonCount).toBe(1);
  });
});
