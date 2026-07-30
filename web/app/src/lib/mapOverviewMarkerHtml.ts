import { formatCompactCount } from './formatCount';
import { usernameMapLabelHtml, type UsernameWaveTint } from './usernameColor';

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
  if (opts.kind === 'salon' && !opts.isLive) {
    return `<div class="map-marker-overview-pin map-marker-overview-pin--salon" role="img"><span class="map-marker-overview-salon-badge">SALON</span><span class="map-marker-overview-dot salon"></span></div>`;
  }

  const liveClass = opts.isLive || opts.kind === 'live' ? ' map-marker-overview-pin--live' : '';
  const dotClass = 'map-marker-overview-dot live';
  const liveBadge = '<span class="map-marker-overview-live-badge">LIVE</span>';

  return `<div class="map-marker-overview-pin${liveClass}" role="img">${liveBadge}<span class="${dotClass}"></span></div>`;
}

function buildParticipantCountHtml(count: number | undefined, kind: 'live' | 'salon'): string {
  if (count == null || !Number.isFinite(count)) return '';
  const safe = Math.max(0, Math.floor(count));
  const kindClass = kind === 'live' ? 'map-marker-participant-count--live' : 'map-marker-participant-count--salon';
  return `<span class="map-marker-participant-count ${kindClass}">${escapeHtml(formatCompactCount(safe))}</span>`;
}

/** Marqueur live zoom ville/rue — point rouge + pseudo (sans avatar). */
export function buildFlatLiveMarkerHtml(
  hostName: string,
  usernameColor?: string | null,
  wave?: UsernameWaveTint | null,
  opts?: { viewersCount?: number }
): string {
  const count = buildParticipantCountHtml(opts?.viewersCount, 'live');
  const label = usernameMapLabelHtml(hostName, usernameColor, { wave: wave ?? undefined });
  return `<div class="map-marker live"><div class="map-marker-dot-row"><span class="map-marker-live-dot" aria-hidden="true"></span>${count}</div>${label}</div>`;
}

/** Marqueur salon zoom ville/rue — point violet + pseudo (sans avatar). */
export function buildFlatSalonMarkerHtml(
  hostName: string,
  usernameColor?: string | null,
  wave?: UsernameWaveTint | null,
  opts?: { isBot?: boolean; listenersCount?: number }
): string {
  const botBadge = opts?.isBot ? '<span class="bot-badge">BOT</span>' : '';
  const botClass = opts?.isBot ? ' bot' : '';
  const count = buildParticipantCountHtml(opts?.listenersCount, 'salon');
  const label = usernameMapLabelHtml(hostName, usernameColor, { wave: wave ?? undefined });
  return `<div class="map-marker salon${botClass}">${botBadge}<div class="map-marker-dot-row"><span class="map-marker-salon-dot" aria-hidden="true"></span>${count}</div>${label}</div>`;
}

/** Pin live regroupé (plusieurs sessions au même lieu) — pastille + compteur. */
export function buildLiveClusterOverviewMarkerHtml(count: number): string {
  const badge =
    count > 1
      ? `<span class="map-marker-live-cluster-badge">${escapeHtml(String(count))}</span>`
      : '';
  return `<div class="map-marker-overview-pin map-marker-overview-pin--live" role="img">${badge}<span class="map-marker-overview-dot live"></span></div>`;
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
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 21h18"/><path d="M6 21V9l6-4 6 4v12"/><path d="M9 21v-6h6v6"/>
      </svg>
    </span>
    ${badge}${liveBadge}
    <span class="map-marker-city-hub-label">${escapeHtml(shortLabel)}</span>
  </div>`;
}
