import { describe, expect, it } from 'vitest';
import { buildFlatLiveMarkerHtml, buildFlatSalonMarkerHtml, liveMapHostLabel } from './mapOverviewMarkerHtml';

describe('buildFlatLiveMarkerHtml', () => {
  it('renders compact live pin without visible username by default', () => {
    const html = buildFlatLiveMarkerHtml('BeatCastel');
    expect(html).toContain('map-marker-live--compact');
    expect(html).toContain('map-marker-live-dot');
    expect(html).not.toContain('BeatCastel');
    expect(html).not.toContain('live-badge');
  });

  it('includes hover label when hostLabelMode is hover', () => {
    const html = buildFlatLiveMarkerHtml('BeatCastel', null, null, { hostLabelMode: 'hover' });
    expect(html).toContain('map-marker-host-hover-label');
    expect(html).toContain('BeatCastel');
  });

  it('shows viewers count when provided', () => {
    const html = buildFlatLiveMarkerHtml('BeatCastel', null, null, { viewersCount: 1284 });
    expect(html).toContain('map-marker-participant-count--live');
    expect(html).toContain('1.3K');
  });
});

describe('liveMapHostLabel', () => {
  it('prefers hostName over generic Live', () => {
    expect(liveMapHostLabel({ hostName: 'BeatCastel', title: 'Live — BeatCastel' })).toBe('BeatCastel');
  });

  it('falls back to title suffix when hostName is Live', () => {
    expect(liveMapHostLabel({ hostName: 'Live', title: 'Live — BeatCastel' })).toBe('BeatCastel');
  });
});

describe('buildFlatSalonMarkerHtml', () => {
  it('renders purple dot and username without avatar', () => {
    const html = buildFlatSalonMarkerHtml('PopSete');
    expect(html).toContain('map-marker salon');
    expect(html).toContain('map-marker-salon-dot');
    expect(html).toContain('PopSete');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('salon-badge');
  });

  it('keeps bot badge when isBot', () => {
    const html = buildFlatSalonMarkerHtml('PopSete', null, null, { isBot: true });
    expect(html).toContain('bot-badge');
    expect(html).toContain('map-marker salon bot');
  });

  it('shows listeners count when provided', () => {
    const html = buildFlatSalonMarkerHtml('PopSete', null, null, { listenersCount: 42 });
    expect(html).toContain('map-marker-participant-count--salon');
    expect(html).toContain('42');
  });
});
