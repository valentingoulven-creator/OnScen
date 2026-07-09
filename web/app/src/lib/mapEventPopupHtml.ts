import { formatEventDateShort } from './feedEvents';
import { getEventTypeIcon } from './eventType';
import type { MapEventCityCluster, MapEventMarker } from '../types';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatEventTimeForPopup(event: MapEventMarker): string {
  if (!event.eventDate) return '';
  return formatEventDateShort(event.eventDate);
}

function buildEventPopupRow(event: MapEventMarker): string {
  const title = event.title.trim() || 'Événement';
  const time = formatEventTimeForPopup(event);
  const icon = getEventTypeIcon(event.eventType);
  return `<button type="button" class="map-event-popup-item" data-event-id="${escapeHtml(event.id)}">
    <span class="map-event-popup-icon" aria-hidden="true">${icon}</span>
    <span class="map-event-popup-body">
      <span class="map-event-popup-title">${escapeHtml(title)}</span>
      ${time ? `<span class="map-event-popup-time">${escapeHtml(time)}</span>` : ''}
    </span>
  </button>`;
}

/** HTML popup Leaflet : liste cliquable si plusieurs événements au même lieu. */
export function buildEventClusterPopupHtml(cluster: MapEventCityCluster): string {
  const heading =
    cluster.count > 1
      ? `${cluster.count} événements aujourd\u2019hui`
      : 'Événement aujourd\u2019hui';
  const subtitle = cluster.cityLabel.trim()
    ? `<p class="map-event-popup-place">${escapeHtml(cluster.cityLabel)}</p>`
    : '';

  if (cluster.count === 1 && cluster.events[0]) {
    return `<div class="map-event-popup">
      <p class="map-event-popup-heading">${heading}</p>
      ${subtitle}
      <div class="map-event-popup-list">${buildEventPopupRow(cluster.events[0])}</div>
    </div>`;
  }

  const rows = cluster.events.map(buildEventPopupRow).join('');
  return `<div class="map-event-popup">
    <p class="map-event-popup-heading">${heading}</p>
    ${subtitle}
    <div class="map-event-popup-list">${rows}</div>
  </div>`;
}
