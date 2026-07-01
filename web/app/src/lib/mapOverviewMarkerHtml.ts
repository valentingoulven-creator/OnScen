function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildOverviewGeoMarkerHtml(opts: {
  kind: 'salon' | 'live';
  isLive: boolean;
}): string {
  const liveClass = opts.isLive || opts.kind === 'live' ? ' map-marker-overview-pin--live' : '';
  const salonClass = opts.kind === 'salon' && !opts.isLive ? ' map-marker-overview-pin--salon' : '';
  const dotClass =
    opts.isLive || opts.kind === 'live'
      ? 'map-marker-overview-dot live'
      : 'map-marker-overview-dot salon';

  const pulse =
    opts.isLive || opts.kind === 'live'
      ? '<span class="map-marker-overview-pulse" aria-hidden="true"></span>'
      : '';

  return `<div class="map-marker-overview-pin${liveClass}${salonClass}" role="img">${pulse}<span class="${dotClass}"></span></div>`;
}

export function buildMajorCityHubMarkerHtml(cityLabel: string, count: number, liveCount: number): string {
  const shortLabel = cityLabel.length > 14 ? `${cityLabel.slice(0, 12)}…` : cityLabel;
  const badge =
    count > 1
      ? `<span class="map-marker-city-hub-badge">${escapeHtml(String(count))}</span>`
      : '';
  const liveBadge =
    liveCount > 0
      ? `<span class="map-marker-city-hub-live">${liveCount > 1 ? `${liveCount} LIVE` : 'LIVE'}</span>`
      : '';

  return `<div class="map-marker-city-hub" role="img">
    <span class="map-marker-city-hub-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 21h18"/><path d="M6 21V9l6-4 6 4v12"/><path d="M9 21v-6h6v6"/>
      </svg>
    </span>
    ${badge}${liveBadge}
    <span class="map-marker-city-hub-label">${escapeHtml(shortLabel)}</span>
  </div>`;
}
