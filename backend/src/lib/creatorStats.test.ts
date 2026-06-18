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
  });
});
