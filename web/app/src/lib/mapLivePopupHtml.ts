import type { MapLiveLocationCluster } from './mapLiveClusters';
import type { Live, Salon } from '../types';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildSalonPopupRow(salon: Salon): string {
  const viewers = Math.max(0, salon.listenersCount ?? 0);
  return `<button type="button" class="map-event-popup-item" data-salon-id="${escapeHtml(salon.id)}">
    <span class="map-event-popup-icon" aria-hidden="true">🎵</span>
    <span class="map-event-popup-body">
      <span class="map-event-popup-title">${escapeHtml(salon.title)}</span>
      <span class="map-event-popup-time">${escapeHtml(salon.hostName)} · ${viewers} spectateur${viewers !== 1 ? 's' : ''}</span>
    </span>
  </button>`;
}

function buildLivePopupRow(live: Live): string {
  const title = live.title.trim() || live.playbackState?.title || 'Live';
  const viewers = Math.max(0, live.viewersCount ?? 0);
  return `<button type="button" class="map-event-popup-item" data-live-id="${escapeHtml(live.id)}">
    <span class="map-event-popup-icon" aria-hidden="true">🔴</span>
    <span class="map-event-popup-body">
      <span class="map-event-popup-title">${escapeHtml(title)}</span>
      <span class="map-event-popup-time">${escapeHtml(live.hostName)} · ${viewers} spectateur${viewers !== 1 ? 's' : ''}</span>
    </span>
  </button>`;
}

/** HTML popup Leaflet : liste cliquable si plusieurs lives au même lieu. */
export function buildLiveClusterPopupHtml(cluster: MapLiveLocationCluster): string {
  const heading =
    cluster.count > 1
      ? `${cluster.count} lives au même endroit`
      : 'Live en cours';

  const rows = [
    ...cluster.salons.map(buildSalonPopupRow),
    ...cluster.lives.map(buildLivePopupRow),
  ].join('');

  return `<div class="map-event-popup">
    <p class="map-event-popup-heading">${escapeHtml(heading)}</p>
    <div class="map-event-popup-list">${rows}</div>
  </div>`;
}
