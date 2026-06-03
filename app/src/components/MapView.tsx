import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { Salon, Live, NearbyPerson } from '../types';

function stripLeafletAttribution(container: HTMLElement | null) {
  if (!container) return;
  container.querySelectorAll('.leaflet-control-attribution').forEach((el) => el.remove());
}

interface MapViewProps {
  salons: Salon[];
  lives: Live[];
  people?: NearbyPerson[];
  center: [number, number];
  userPosition?: [number, number];
  onSelectSalon: (s: Salon) => void;
  onSelectLive: (l: Live) => void;
  onSelectPerson?: (person: NearbyPerson) => void;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
}: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.CircleMarker | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const map = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView(center, 14);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '',
      maxZoom: 19,
    }).addTo(map);

    if (map.attributionControl) {
      map.removeControl(map.attributionControl);
    }
    stripLeafletAttribution(mapRef.current);
    map.on('layeradd', () => stripLeafletAttribution(mapRef.current));

    const observer = new MutationObserver(() => stripLeafletAttribution(mapRef.current));
    observer.observe(mapRef.current, { childList: true, subtree: true });

    mapInstance.current = map;
    markersRef.current = L.layerGroup().addTo(map);

    return () => {
      observer.disconnect();
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapInstance.current) return;
    mapInstance.current.flyTo(center, 14, { duration: 0.6 });
  }, [center]);

  useEffect(() => {
    if (!mapInstance.current || !userPosition) return;
    if (!userMarkerRef.current) {
      userMarkerRef.current = L.circleMarker(userPosition, {
        radius: 9,
        fillColor: '#6366f1',
        fillOpacity: 1,
        color: '#ffffff',
        weight: 3,
      }).addTo(mapInstance.current);
    } else {
      userMarkerRef.current.setLatLng(userPosition);
    }
  }, [userPosition]);

  useEffect(() => {
    if (!markersRef.current) return;
    markersRef.current.clearLayers();

    salons.forEach((s) => {
      const botClass = s.isBot ? 'bot' : '';
      const liveClass = s.isLive ? 'live' : '';
      const botBadge = s.isBot ? '<span class="bot-badge">BOT</span>' : '';
      const liveBadge = s.isLive ? '<span class="live-badge">LIVE</span>' : '';
      const icon = L.divIcon({
        className: '',
        html: `<div class="map-marker ${botClass} ${liveClass}">${botBadge}${liveBadge}<img src="${s.playbackState.albumArtUrl || ''}" alt=""/><span>${s.playbackState.title.slice(0, 12)}</span></div>`,
        iconSize: [56, 56],
        iconAnchor: [28, 28],
      });
      const m = L.marker([s.latitude, s.longitude], { icon }).addTo(markersRef.current!);
      m.on('click', () => onSelectSalon(s));
    });

    lives.forEach((l) => {
      if (salons.some((s) => s.id === l.id)) return;
      const icon = L.divIcon({
        className: '',
        html: `<div class="map-marker live"><span class="live-badge">LIVE</span><img src="${l.playbackState.albumArtUrl || ''}" alt=""/></div>`,
        iconSize: [56, 56],
        iconAnchor: [28, 28],
      });
      const m = L.marker([l.latitude, l.longitude], { icon }).addTo(markersRef.current!);
      m.on('click', () => onSelectLive(l));
    });

    people.forEach((p) => {
      if (p.latitude == null || p.longitude == null) return;
      const avatar =
        p.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(p.id)}`;
      const botClass = p.isBot ? 'bot' : '';
      const icon = L.divIcon({
        className: '',
        html: `<div class="map-marker person ${botClass}"><img src="${escapeHtml(avatar)}" alt=""/><span>${escapeHtml(p.username.slice(0, 12))}</span></div>`,
        iconSize: [56, 56],
        iconAnchor: [28, 28],
      });
      const m = L.marker([p.latitude, p.longitude], { icon }).addTo(markersRef.current!);
      m.on('click', () => onSelectPerson?.(p));
    });
  }, [salons, lives, people, onSelectSalon, onSelectLive, onSelectPerson]);

  return <div ref={mapRef} className="absolute inset-0 z-0" />;
}
