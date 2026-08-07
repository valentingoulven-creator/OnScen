import { describe, expect, it, beforeEach } from 'vitest';
import { db } from '../models/schema';
import {
  getSponsorAnalyticsSummary,
  restoreSponsorAnalyticsBuckets,
  trackSponsorAnalyticsEvent,
} from './sponsorAnalytics';

describe('sponsorAnalytics', () => {
  beforeEach(() => {
    restoreSponsorAnalyticsBuckets(undefined);
    db.sponsors.length = 0;
    db.sponsors.push({
      id: 'test-sp',
      name: 'Test',
      placement: 'map_banner',
      active: true,
      priority: 1,
      title: 'T',
      subtitle: 'S',
      cta: 'Go',
      kind: 'promo',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });

  it('aggregates impressions and clicks', () => {
    trackSponsorAnalyticsEvent('impression', 'test-sp', 'map_banner');
    trackSponsorAnalyticsEvent('impression', 'test-sp', 'map_banner');
    trackSponsorAnalyticsEvent('click', 'test-sp', 'map_banner');
    const summary = getSponsorAnalyticsSummary(5);
    expect(summary.impressionsTotal).toBe(2);
    expect(summary.clicksTotal).toBe(1);
    expect(summary.ctrTotal).toBe(50);
  });
});
