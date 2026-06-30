import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../models/schema';
import { getCreatorDashboardStats } from './creatorStats';

describe('getCreatorDashboardStats', () => {
  beforeEach(() => {
    db.lives.clear();
    db.gifts.length = 0;
  });

  it('agrège pourboires et pics de spectateurs par hôte', () => {
    db.lives.set('live1', {
      id: 'live1',
      hostId: 'host1',
      hostName: 'Host',
      title: 'Live 1',
      platform: 'youtube',
      playbackState: {
        platform: 'youtube',
        trackId: 'x',
        title: 'T',
        artist: 'A',
        isPlaying: false,
        progressMs: 0,
        updatedAt: 1,
      },
      latitude: 0,
      longitude: 0,
      blurredLatitude: 0,
      blurredLongitude: 0,
      viewersCount: 2,
      peakViewersCount: 12,
      isActive: false,
      startedAt: 1000,
      endedAt: 2000,
    });

    db.gifts.push({
      id: 'g1',
      liveId: 'live1',
      senderId: 'fan1',
      senderName: 'Fan',
      giftType: 'don',
      amount: 5,
      timestamp: Date.now(),
    });

    const stats = getCreatorDashboardStats('host1');
    expect(stats.tipsTotalCents).toBe(500);
    expect(stats.tipsCount).toBe(1);
    expect(stats.totalLivePeakViews).toBe(12);
    expect(stats.archivedLiveCount).toBe(1);
    expect(stats.liveCount).toBe(1);
    expect(stats.topDonors).toHaveLength(1);
    expect(stats.topDonors[0].amountCents).toBe(500);
  });

  it('filtre par mois et année', () => {
    const jan2026 = new Date(2026, 0, 15).getTime();
    const mar2026 = new Date(2026, 2, 10).getTime();

    db.lives.set('live-jan', {
      id: 'live-jan',
      hostId: 'host1',
      hostName: 'Host',
      title: 'Jan',
      platform: 'youtube',
      playbackState: {
        platform: 'youtube',
        trackId: 'x',
        title: 'T',
        artist: 'A',
        isPlaying: false,
        progressMs: 0,
        updatedAt: 1,
      },
      latitude: 0,
      longitude: 0,
      blurredLatitude: 0,
      blurredLongitude: 0,
      viewersCount: 1,
      peakViewersCount: 5,
      isActive: false,
      startedAt: jan2026,
      endedAt: jan2026 + 3600_000,
    });

    db.lives.set('live-mar', {
      id: 'live-mar',
      hostId: 'host1',
      hostName: 'Host',
      title: 'Mar',
      platform: 'youtube',
      playbackState: {
        platform: 'youtube',
        trackId: 'x',
        title: 'T',
        artist: 'A',
        isPlaying: false,
        progressMs: 0,
        updatedAt: 1,
      },
      latitude: 0,
      longitude: 0,
      blurredLatitude: 0,
      blurredLongitude: 0,
      viewersCount: 1,
      peakViewersCount: 20,
      isActive: false,
      startedAt: mar2026,
      endedAt: mar2026 + 3600_000,
    });

    db.gifts.push({
      id: 'g-jan',
      liveId: 'live-jan',
      senderId: 'fan1',
      senderName: 'Fan Jan',
      giftType: 'don',
      amount: 3,
      timestamp: jan2026 + 1000,
    });

    db.gifts.push({
      id: 'g-mar',
      liveId: 'live-mar',
      senderId: 'fan2',
      senderName: 'Fan Mar',
      giftType: 'don',
      amount: 7,
      timestamp: mar2026 + 1000,
    });

    const janStats = getCreatorDashboardStats('host1', { year: 2026, month: 1 });
    expect(janStats.liveCount).toBe(1);
    expect(janStats.totalLivePeakViews).toBe(5);
    expect(janStats.tipsTotalCents).toBe(300);

    const yearStats = getCreatorDashboardStats('host1', { year: 2026 });
    expect(yearStats.liveCount).toBe(2);
    expect(yearStats.tipsTotalCents).toBe(1000);
  });
});
