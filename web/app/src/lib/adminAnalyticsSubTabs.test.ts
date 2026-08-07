import { describe, expect, it } from 'vitest';
import {
  defaultAnalyticsSubTab,
  getAnalyticsSubTabsForRole,
  isAnalyticsSubTabAllowed,
  normalizeAnalyticsSubTab,
} from './adminAnalyticsSubTabs';

describe('adminAnalyticsSubTabs', () => {
  it('normalizes legacy overview to activity', () => {
    expect(normalizeAnalyticsSubTab('overview')).toBe('activity');
  });

  it('exposes platform only for operational admin', () => {
    expect(getAnalyticsSubTabsForRole('admin')).toEqual(['platform']);
    expect(isAnalyticsSubTabAllowed('costs', 'admin')).toBe(false);
    expect(isAnalyticsSubTabAllowed('platform', 'admin')).toBe(true);
  });

  it('exposes all sub-tabs for dev', () => {
    expect(getAnalyticsSubTabsForRole('dev')).toContain('costs');
    expect(isAnalyticsSubTabAllowed('activity', 'dev')).toBe(true);
  });

  it('defaults to platform', () => {
    expect(defaultAnalyticsSubTab('admin')).toBe('platform');
    expect(defaultAnalyticsSubTab('dev')).toBe('platform');
  });
});
