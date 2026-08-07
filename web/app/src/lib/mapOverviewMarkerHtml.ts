import type { Live } from '../types';
import { formatCompactCount } from './formatCount';
import { usernameMapLabelHtml, type UsernameWaveTint } from './usernameColor';

/** Pseudo hôte pour marqueurs carte (évite le libellé générique « Live »). */
export function liveMapHostLabel(l: Pick<Live, 'hostName' | 'title'>): string {
  const raw = l.hostName?.trim() ?? '';
  if (raw && !/^live$/i.test(raw)) return raw;
  const title = l.title?.trim() ?? '';
  const fromTitle = title.match(/^Live\s*[—–-]\s*(.+)$/i)?.[1]?.trim();
  if (fromTitle) return fromTitle;
  if (title && !/^live$/i.test(title)) return title;
  return raw || 'Hôte';
}

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
  hostLabel?: string;
  usernameColor?: string | null;
  wave?: UsernameWaveTint | null;
  /** Affiche le badge « LIVE » (défaut : false pour pins live carte). */
  showLiveBadge?: boolean;
  /** Affiche le pseudo sous le pin (défaut : false). */
  showHostLabel?: boolean;
}): string {
  if (opts.kind === 'salon' && !opts.isLive) {
    return `<div class="map-marker-overview-pin map-marker-overview-pin--salon" role="img"><span class="map-marker-overview-salon-badge">SALON</span><span class="map-marker-overview-dot salon"></span></div>`;
  }

  const liveClass = opts.isLive || opts.kind === 'live' ? ' map-marker-overview-pin--live' : '';
  const dotClass = 'map-marker-overview-dot live';
  const liveBadge =
    opts.showLiveBadge === true
      ? '<span class="map-marker-overview-live-badge">LIVE</span>'
      : '';
  const hostLabel = opts.hostLabel?.trim();
  const nameHtml =
    opts.showHostLabel === true && hostLabel && hostLabel.length > 0
      ? usernameMapLabelHtml(hostLabel, opts.usernameColor, { wave: opts.wave ?? undefined, maxLength: 14 })
      : '';
  const labeledClass = nameHtml ? ' map-marker-overview-pin--labeled' : '';

  return `<div class="map-marker-overview-pin${liveClass}${labeledClass}" role="img">${liveBadge}<span class="${dotClass}"></span>${nameHtml}</div>`;
}

function buildParticipantCountHtml(count: number | undefined, kind: 'live' | 'salon'): string {
  if (count == null || !Number.isFinite(count)) return '';
  const safe = Math.max(0, Math.floor(count));
  const kindClass = kind === 'live' ? 'map-marker-participant-count--live' : 'map-marker-participant-count--salon';
  return `<span class="map-marker-participant-count ${kindClass}">${escapeHtml(formatCompactCount(safe))}</span>`;
}

/** Marqueur live zoom ville/rue — point rouge + spectateurs ; pseudo au survol (globe) si demandé. */
export function buildFlatLiveMarkerHtml(
  hostName: string,
  usernameColor?: string | null,
  wave?: UsernameWaveTint | null,
  opts?: {
    viewersCount?: number;
    live?: Pick<Live, 'hostName' | 'title'>;
    /** `hover` = pseudo visible au survol (globe) ; défaut = masqué (carte plate). */
    hostLabelMode?: 'none' | 'hover';
  }
): string {
  const count = buildParticipantCountHtml(opts?.viewersCount, 'live');
  const mode = opts?.hostLabelMode ?? 'none';
  const labelText = opts?.live ? liveMapHostLabel(opts.live) : hostName;
  const hoverLabel =
    mode === 'hover' && labelText
      ? `<span class="map-marker-host-hover-label">${usernameMapLabelHtml(labelText, usernameColor, { wave: wave ?? undefined })}</span>`
      : '';
  return `<div class="map-marker live map-marker-live--compact"><div class="map-marker-dot-row"><span class="map-marker-live-dot" aria-hidden="true"></span>${count}</div>${hoverLabel}</div>`;
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
