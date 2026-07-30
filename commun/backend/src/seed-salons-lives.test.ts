import { beforeEach, describe, expect, it } from 'vitest';

import { db } from './models/schema';
import {
  SALON_LIVE_BOT_SEEDS,
  SALON_LIVE_ID_PREFIX,
  seedProductionSalonsLives,
} from './seed-salons-lives';

describe('seedProductionSalonsLives', () => {
  beforeEach(() => {
    db.users.clear();
    db.salons.clear();
    db.lives.clear();
    db.salonChats.clear();
    db.liveChats.clear();
  });

  it('crée un live avec id partagé salon.id pour les bots withLive', () => {
    seedProductionSalonsLives();
    const indie = SALON_LIVE_BOT_SEEDS.find((s) => s.username === 'IndieMau')!;
    expect(db.salons.has(indie.salonId)).toBe(true);
    expect(db.lives.has(indie.salonId)).toBe(true);
    expect(db.lives.get(indie.salonId)?.salonId).toBe(indie.salonId);

    const legacyId = `${SALON_LIVE_ID_PREFIX}live-bot-indie-mau`;
    expect(db.lives.has(legacyId)).toBe(false);
  });

  it('nettoie les anciens ids live séparés au re-seed', () => {
    const indie = SALON_LIVE_BOT_SEEDS.find((s) => s.username === 'IndieMau')!;
    const legacyId = `${SALON_LIVE_ID_PREFIX}live-bot-indie-mau`;
    db.lives.set(legacyId, {
      id: legacyId,
      salonId: indie.salonId,
      hostId: indie.userId,
      hostName: indie.username,
      title: 'Legacy',
      platform: 'youtube',
      playbackState: {
        platform: 'youtube',
        trackId: 'x',
        title: 'x',
        artist: 'x',
        isPlaying: true,
        progressMs: 0,
        updatedAt: Date.now(),
        startedAt: Date.now(),
      },
      latitude: indie.lat,
      longitude: indie.lng,
      blurredLatitude: indie.lat,
      blurredLongitude: indie.lng,
      viewersCount: 1,
      isActive: true,
      startedAt: Date.now(),
    });

    seedProductionSalonsLives();

    expect(db.lives.has(legacyId)).toBe(false);
    expect(db.lives.has(indie.salonId)).toBe(true);
  });

  it('BeatCastel live : 100 000 spectateurs (showcase)', () => {
    seedProductionSalonsLives();
    const beat = SALON_LIVE_BOT_SEEDS.find((s) => s.username === 'BeatCastel')!;
    expect(db.lives.get(beat.salonId)?.viewersCount).toBe(100_000);
    expect(db.salons.get(beat.salonId)?.listenersCount).toBe(100_000);
  });
});
