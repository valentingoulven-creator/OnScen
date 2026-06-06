import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { formatCompactCount } from '../lib/formatCount';
import { dicebearAdventurerAvatar } from '../lib/avatarUrl';
import type { Salon, Live, NearbyPerson } from '../types';
import { isValidLatLng, sanitizeLatLngTuple } from '../lib/mapCoords';
import { DEFAULT_CENTER } from '../lib/livesGeo';
import { getUsernameStyle, usernameMapLabelHtml } from '../lib/usernameColor';

interface MapViewProps {
  salons: Salon[];
  lives: Live[];
  people?: NearbyPerson[];
  center: [number, number];
  userPosition?: [number, number];
  onSelectSalon: (s: Salon) => void;
  onSelectLive: (l: Live) => void;
  onSelectPerson?: (person: NearbyPerson) => void;
  /** Clic sur le fond de carte (pas un marqueur) — Leaflet n'émet pas click après un drag. */
  onMapBackgroundClick?: () => void;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Retourne des coords toujours valides — jamais NaN. */
function safeCenter(center: [number, number]): [number, number] {
  return isValidLatLng(center[0], center[1])
    ? [center[0], center[1]]
    : [...DEFAULT_CENTER];
}

export function MapView({
  salons,
  lives,
  people = [],
  center,
  userPosition,
  onSelectSalon,
  onSelectLive,
  onSelectPerson,
  onMapBackgroundClick,
}: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const onMapBackgroundClickRef = useRef(onMapBackgroundClick);
  onMapBackgroundClickRef.current = onMapBackgroundClick;

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const initial = safeCenter(center);

    let map: L.Map;
    try {
      map = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: true,
      }).setView(initial, 14);
    } catch (err) {
      console.error('[MapView] Leaflet init error:', err);
      try {
        map = L.map(mapRef.current, {
          zoomControl: false,
          attributionControl: true,
        }).setView([...DEFAULT_CENTER], 14);
      } catch {
        return;
      }
    }

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
    }).addTo(map);

    map.attributionControl?.setPrefix(false);

    mapInstance.current = map;
    markersRef.current = L.layerGroup().addTo(map);

    const onMapClick = () => onMapBackgroundClickRef.current?.();
    map.on('click', onMapClick);

    // Invalider la taille au premier rendu : nécessaire en mode PWA standalone où
    // la fenêtre peut être redimensionnée après que Leaflet ait initialisé.
    const rafId = requestAnimationFrame(() => map.invalidateSize());

    // Invalider aussi à chaque changement de dimensions du conteneur (rotation, PWA, split-screen).
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(mapRef.current);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      map.off('click', onMapClick);
      map.remove();
      mapInstance.current = null;
      markersRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapInstance.current) return;
    if (!isValidLatLng(center[0], center[1])) return;
    try {
      mapInstance.current.flyTo(sanitizeLatLngTuple(center[0], center[1]), 14, { duration: 0.6 });
    } catch (err) {
      console.error('[MapView] flyTo error:', err);
    }
  }, [center]);

  useEffect(() => {
    if (!mapInstance.current || !userPosition) return;
    if (!isValidLatLng(userPosition[0], userPosition[1])) return;
    const safe = sanitizeLatLngTuple(userPosition[0], userPosition[1]);
    try {
      if (!userMarkerRef.current) {
        const userIcon = L.divIcon({
          className: '',
          html: `<div class="map-user-position">
            <svg width="26" height="32" viewBox="0 0 26 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="13" cy="7" r="5.5" fill="#60a5fa"/>
              <path d="M8 14 Q13 11.5 18 14 L17 23 H9 Z" fill="#60a5fa"/>
              <line x1="9" y1="15.5" x2="3.5" y2="21.5" stroke="#60a5fa" stroke-width="2.5" stroke-linecap="round"/>
              <line x1="17" y1="15.5" x2="22.5" y2="21.5" stroke="#60a5fa" stroke-width="2.5" stroke-linecap="round"/>
              <line x1="11" y1="23" x2="8.5" y2="31" stroke="#60a5fa" stroke-width="2.5" stroke-linecap="round"/>
              <line x1="15" y1="23" x2="17.5" y2="31" stroke="#60a5fa" stroke-width="2.5" stroke-linecap="round"/>
            </svg>
            <div class="map-user-dot"></div>
          </div>`,
          iconSize: [26, 44],
          iconAnchor: [13, 42],
        });
        userMarkerRef.current = L.marker(safe, { icon: userIcon, zIndexOffset: 1000 })
          .addTo(mapInstance.current);
      } else {
        userMarkerRef.current.setLatLng(safe);
      }
    } catch (err) {
      console.error('[MapView] userMarker error:', err);
    }
  }, [userPosition]);

  useEffect(() => {
    if (!markersRef.current) return;
    markersRef.current.clearLayers();

    salons.forEach((s) => {
      if (!isValidLatLng(s.latitude, s.longitude)) return;
      const botClass = s.isBot ? 'bot' : '';
      const liveClass = s.isLive ? 'live' : '';
      const botBadge = s.isBot ? '<span class="bot-badge">BOT</span>' : '';
      const liveBadge = s.isLive ? '<span class="live-badge">LIVE</span>' : '';
      const icon = L.divIcon({
        className: '',
        html: `<div class="map-marker ${botClass} ${liveClass}">${botBadge}${liveBadge}<img src="${s.playbackState.albumArtUrl || ''}" alt=""/>${usernameMapLabelHtml(s.hostName, s.hostUsernameColor, { wave: { from: s.hostUsernameWaveFrom, to: s.hostUsernameWaveTo } })}</div>`,
        iconSize: [56, 56],
        iconAnchor: [28, 28],
      });
      try {
        const lat = Number(s.latitude);
        const lon = Number(s.longitude);
        if (!isValidLatLng(lat, lon)) return;
        const m = L.marker([lat, lon], { icon }).addTo(markersRef.current!);
        m.on('click', (ev) => {
          L.DomEvent.stopPropagation(ev.originalEvent);
          onSelectSalon(s);
        });
      } catch (err) {
        console.error('[MapView] salon marker error:', err);
      }
    });

    lives.forEach((l) => {
      if (!isValidLatLng(l.latitude, l.longitude)) return;
      if (salons.some((s) => s.id === l.id)) return;
      const icon = L.divIcon({
        className: '',
        html: `<div class="map-marker live"><span class="live-badge">LIVE</span><img src="${l.playbackState.albumArtUrl || ''}" alt=""/>${usernameMapLabelHtml(l.hostName, l.hostUsernameColor, { wave: { from: l.hostUsernameWaveFrom, to: l.hostUsernameWaveTo } })}</div>`,
        iconSize: [56, 56],
        iconAnchor: [28, 28],
      });
      try {
        const lat = Number(l.latitude);
        const lon = Number(l.longitude);
        if (!isValidLatLng(lat, lon)) return;
        const m = L.marker([lat, lon], { icon }).addTo(markersRef.current!);
        m.on('click', (ev) => {
          L.DomEvent.stopPropagation(ev.originalEvent);
          onSelectLive(l);
        });
      } catch (err) {
        console.error('[MapView] live marker error:', err);
      }
    });

    people.forEach((p) => {
      if (!isValidLatLng(p.latitude, p.longitude)) return;
      const avatar = p.avatarUrl?.trim() || dicebearAdventurerAvatar(p.id);
      const avatarFallback = dicebearAdventurerAvatar(p.id);
      const avatarOnError = `this.onerror=null;this.src='${avatarFallback.replace(/'/g, '%27')}';`;
      const botClass = p.isBot ? 'bot' : '';
      const liveClass = p.isLive ? 'live' : '';
      const liveBadge = p.isLive ? '<span class="live-badge">LIVE</span>' : '';
      const viewersLabel =
        p.isLive && p.liveViewersCount != null
          ? `<span class="viewer-count">${escapeHtml(formatCompactCount(p.liveViewersCount))}</span>`
          : '';
      const icon = L.divIcon({
        className: '',
        html: `<div class="map-marker person ${botClass} ${liveClass}"><div class="map-marker-person-top">${viewersLabel}<div class="person-avatar-stack">${liveBadge}<img src="${escapeHtml(avatar)}" alt="" onerror="${avatarOnError}"/></div></div>${usernameMapLabelHtml(p.username, p.usernameColor, { wave: { from: p.usernameWaveFrom, to: p.usernameWaveTo } })}</div>`,
        iconSize: [56, 56],
        iconAnchor: [28, 28],
      });
      try {
        const lat = Number(p.latitude);
        const lon = Number(p.longitude);
        if (!isValidLatLng(lat, lon)) return;
        const m = L.marker([lat, lon], { icon }).addTo(markersRef.current!);
        if (p.isLive && p.liveId) {
          m.bindPopup(
            (() => {
              const { className, style } = getUsernameStyle(p.usernameColor, {
                from: p.usernameWaveFrom,
                to: p.usernameWaveTo,
              });
              const styleAttr = style ? ` style="${style}"` : '';
              return `<div class="map-person-popup"><strong class="${className}"${styleAttr}>${escapeHtml(p.username)}</strong><br/><span class="live-badge">LIVE</span></div>`;
            })()
          );
        }
        m.on('click', (ev) => {
          L.DomEvent.stopPropagation(ev.originalEvent);
          onSelectPerson?.(p);
        });
      } catch (err) {
        console.error('[MapView] person marker error:', err);
      }
    });
  }, [salons, lives, people, onSelectSalon, onSelectLive, onSelectPerson]);

  return <div ref={mapRef} className="absolute inset-0 z-0" />;
}
