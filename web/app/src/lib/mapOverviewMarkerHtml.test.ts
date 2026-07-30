import { describe, expect, it } from 'vitest';
import { buildFlatLiveMarkerHtml, buildFlatSalonMarkerHtml } from './mapOverviewMarkerHtml';

describe('buildFlatLiveMarkerHtml', () => {
  it('renders red dot and username without avatar', () => {
    const html = buildFlatLiveMarkerHtml('BeatCastel');
    expect(html).toContain('map-marker live');
    expect(html).toContain('map-marker-live-dot');
    expect(html).toContain('BeatCastel');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('live-badge');
  });

  it('shows viewers count when provided', () => {
    const html = buildFlatLiveMarkerHtml('BeatCastel', null, null, { viewersCount: 1284 });
    expect(html).toContain('map-marker-participant-count--live');
    expect(html).toContain('1.3K');
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
