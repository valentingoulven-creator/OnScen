import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../models/schema';
import {
  assertCanJoinLiveAsViewer,
  assertCanStartLive,
  assertCanUseCloudflareObs,
  canAccessArchivedLives,
  getHostDailyLiveMinutesUsed,
  getUserPlatformPlan,
  OBS_OPEN_TO_ALL,
  PlatformPlanError,
} from './platformPlans';
import { recordCreatorSubscription } from './subscriptions';

describe('platformPlans', () => {
  beforeEach(() => {
    db.lives.clear();
    db.creatorSubscriptions.length = 0;
    db.users.clear();
    db.users.set('host1', {
      id: 'host1',
      username: 'Host',
      email: 'host@test.local',
      passwordHash: 'x',
      meloCoins: 0,
      isGhostMode: false,
      lastSeenAt: Date.now(),
      age: 25,
    });
  });

  it('free plan par défaut', () => {
    const plan = getUserPlatformPlan('host1');
    expect(plan.id).toBe('free');
    expect(plan.limits.maxViewers).toBe(30);
    expect(plan.limits.maxLiveMinutesPerDay).toBe(120);
    expect(plan.limits.allowObs).toBe(false);
  });

  it('onscen_plus autorise les rediffusions archivées', () => {
    recordCreatorSubscription({
      subscriberId: 'host1',
      creatorId: 'platform',
      tierId: 'onscen_plus',
      tierLabel: 'OnScen+',
      amountCents: 999,
      targetType: 'platform',
      paymentMode: 'simulation',
    });
    expect(canAccessArchivedLives('host1')).toBe(true);
  });

  it('free refuse les rediffusions archivées', () => {
    expect(canAccessArchivedLives('host1')).toBe(false);
  });

  it('onscen_plus via abonnement plateforme', () => {
    recordCreatorSubscription({
      subscriberId: 'host1',
      creatorId: 'platform',
      tierId: 'onscen_plus',
      tierLabel: 'OnScen+',
      amountCents: 999,
      targetType: 'platform',
      paymentMode: 'simulation',
    });
    const plan = getUserPlatformPlan('host1');
    expect(plan.id).toBe('onscen_plus');
    expect(plan.limits.maxViewers).toBe(400);
  });

  it('onscen_ultra autorise OBS', () => {
    recordCreatorSubscription({
      subscriberId: 'host1',
      creatorId: 'platform',
      tierId: 'onscen_ultra',
      tierLabel: 'OnScenUltra',
      amountCents: 1999,
      targetType: 'platform',
      paymentMode: 'simulation',
    });
    expect(() => assertCanUseCloudflareObs('host1')).not.toThrow();
  });

  it('free refuse OBS when OBS_OPEN_TO_ALL est false', () => {
    if (OBS_OPEN_TO_ALL) {
      expect(() => assertCanUseCloudflareObs('host1')).not.toThrow();
      return;
    }
    expect(() => assertCanUseCloudflareObs('host1')).toThrow(PlatformPlanError);
  });

  it('bloque le démarrage si quota journalier dépassé', () => {
    const dayStart = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
    db.lives.set('live_old', {
      id: 'live_old',
      hostId: 'host1',
      hostName: 'Host',
      title: 'Test',
      platform: 'youtube',
      playbackState: {
        platform: 'youtube',
        trackId: 'x',
        title: 'T',
        artist: 'A',
        isPlaying: false,
        progressMs: 0,
        updatedAt: dayStart,
      },
      latitude: 0,
      longitude: 0,
      blurredLatitude: 0,
      blurredLongitude: 0,
      viewersCount: 0,
      isActive: false,
      startedAt: dayStart,
      endedAt: dayStart + 121 * 60_000,
    });
    expect(getHostDailyLiveMinutesUsed('host1')).toBeGreaterThanOrEqual(121);
    expect(() => assertCanStartLive('host1')).toThrow(/limite de diffusion live/i);
  });

  it('refuse un spectateur au-delà du plafond', () => {
    expect(() => assertCanJoinLiveAsViewer('host1', 30, 'viewer1')).toThrow(/complet/i);
    expect(() => assertCanJoinLiveAsViewer('host1', 29, 'viewer1')).not.toThrow();
    expect(() => assertCanJoinLiveAsViewer('host1', 999, 'host1')).not.toThrow();
  });
});
