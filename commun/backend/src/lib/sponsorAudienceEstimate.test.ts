import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../models/schema';
import {
  countEligibleActiveUsers,
  estimateSponsorAudience,
  SPONSOR_REGION_AUDIENCE_RADIUS_KM,
} from './sponsorAudienceEstimate';

describe('sponsorAudienceEstimate', () => {
  beforeEach(() => {
    db.users.clear();
  });

  it('compte les utilisateurs actifs sur 30 j (hors bots et bloqués)', () => {
    const now = Date.now();
    db.users.set('u1', {
      id: 'u1',
      username: 'a',
      email: 'a@test.com',
      passwordHash: 'x',
      meloCoins: 0,
      isGhostMode: false,
      lastSeenAt: now,
    });
    db.users.set('bot', {
      id: 'bot',
      username: 'bot',
      email: 'bot@bot.local',
      passwordHash: 'x',
      meloCoins: 0,
      isGhostMode: false,
      lastSeenAt: now,
    });
    db.users.set('old', {
      id: 'old',
      username: 'old',
      email: 'old@test.com',
      passwordHash: 'x',
      meloCoins: 0,
      isGhostMode: false,
      lastSeenAt: now - 40 * 86_400_000,
    });

    expect(countEligibleActiveUsers()).toBe(1);
    expect(estimateSponsorAudience({ placement: 'feed_inline' }).estimatedUsers).toBe(1);
  });

  it('estime la zone régionale autour des coordonnées cible', () => {
    const now = Date.now();
    db.users.set('near', {
      id: 'near',
      username: 'near',
      email: 'near@test.com',
      passwordHash: 'x',
      meloCoins: 0,
      isGhostMode: false,
      lastSeenAt: now,
      latitude: 43.61,
      longitude: 3.87,
    });
    db.users.set('far', {
      id: 'far',
      username: 'far',
      email: 'far@test.com',
      passwordHash: 'x',
      meloCoins: 0,
      isGhostMode: false,
      lastSeenAt: now,
      latitude: 48.85,
      longitude: 2.35,
    });

    const est = estimateSponsorAudience({
      placement: 'map_banner',
      mapVisibilityScope: 'region',
      mapTargetLat: 43.6108,
      mapTargetLng: 3.8767,
    });

    expect(est.basis).toBe('active_30d_region');
    expect(est.regionRadiusKm).toBe(SPONSOR_REGION_AUDIENCE_RADIUS_KM);
    expect(est.estimatedUsers).toBe(1);
  });
});
