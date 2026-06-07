import { forwardRef, lazy, Suspense, useEffect, useImperativeHandle, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import type { GlobeViewProps } from './GlobeView';
import { formatCompactCount } from '../lib/formatCount';
import { dicebearAdventurerAvatar } from '../lib/avatarUrl';
import type { Salon, Live, NearbyPerson } from '../types';
import { isValidLatLng, sanitizeLatLngTuple } from '../lib/mapCoords';
import { DEFAULT_CENTER } from '../lib/livesGeo';
import { WORLD_CAPITALS } from '../lib/worldCapitals';
import { getUsernameStyle, usernameMapLabelHtml } from '../lib/usernameColor';

// Lazy-load the 3D globe (large Three.js bundle) only when needed.
const LazyGlobeView = lazy<React.ComponentType<GlobeViewProps>>(
  () => import('./GlobeView').then((m) => ({ default: m.GlobeView }))
);

export type MapStyle = 'flat' | 'globe';

/** Handle impératif exposé par MapView via forwardRef. */
export interface MapViewHandle {
  /** Repositionne la carte Leaflet instantanément (sans animation). */
  jumpTo: (lat: number, lng: number, zoom?: number) => void;
  /** Anime en douceur la carte vers les coordonnées et le zoom donnés. */
  flyTo: (lat: number, lng: number, zoom?: number) => void;
}

/** Max person markers rendered on the flat map to avoid freezing with 10 000+ bots. */
const MAX_PERSON_MARKERS = 300;

/** Zoom level at which capital names become permanently visible on the flat map. */
const CAPITAL_LABEL_MIN_ZOOM = 5;

const TILE_LAYERS: Record<MapStyle, { url: string; attribution: string; maxZoom: number }> = {
  flat: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
    maxZoom: 19,
  },
  globe: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
    maxZoom: 19,
  },
};

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
  /** Style du fond de carte : 'flat' = carte sombre (défaut), 'globe' = satellite. */
  mapStyle?: MapStyle;
  /**
   * Appelé par GlobeView après l'animation de zoom sur un marqueur ou lors
   * d'un zoom manuel sous le seuil d'altitude. `zoom` est le niveau Leaflet cible.
   */
  onGlobeZoomToFlat?: (lat: number, lng: number, doSelect: () => void, zoom?: number) => void;
  /** Appelé quand le zoom descend à ≤ 2 sur la carte plate → bascule automatiquement vers le globe. */
  onAutoSwitchToGlobe?: () => void;
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

export const MapView = forwardRef<MapViewHandle, MapViewProps>(function MapView({
  salons,
  lives,
  people = [],
  center,
  userPosition,
  onSelectSalon,
  onSelectLive,
  onSelectPerson,
  onMapBackgroundClick,
  mapStyle = 'flat',
  onGlobeZoomToFlat,
  onAutoSwitchToGlobe,
}: MapViewProps, ref) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  // Separate layer for salons + lives (always visible, small count).
  const salonLiveLayerRef = useRef<L.LayerGroup | null>(null);
  // Cluster group for person markers (up to MAX_PERSON_MARKERS).
  const personClusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const capitalsLayerRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // Crossfade state: globe stays mounted briefly while Leaflet fades in
  const [showGlobe, setShowGlobe] = useState(mapStyle === 'globe');
  const [leafletReady, setLeafletReady] = useState(mapStyle !== 'globe');
  const [flatMapZoom, setFlatMapZoom] = useState(14);
  const globeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable refs for callbacks — prevents markers useEffect from re-running on every parent render.
  const onMapBackgroundClickRef = useRef(onMapBackgroundClick);
  onMapBackgroundClickRef.current = onMapBackgroundClick;
  const onSelectSalonRef = useRef(onSelectSalon);
  onSelectSalonRef.current = onSelectSalon;
  const onSelectLiveRef = useRef(onSelectLive);
  onSelectLiveRef.current = onSelectLive;
  const onSelectPersonRef = useRef(onSelectPerson);
  onSelectPersonRef.current = onSelectPerson;
  const onAutoSwitchToGlobeRef = useRef(onAutoSwitchToGlobe);
  onAutoSwitchToGlobeRef.current = onAutoSwitchToGlobe;
  // Track current mapStyle in a ref so the zoomend handler (created once) can read it.
  const mapStyleRef = useRef(mapStyle);
  mapStyleRef.current = mapStyle;

  useImperativeHandle(ref, () => ({
    jumpTo(lat: number, lng: number, zoom = 14) {
      if (!mapInstance.current || !isValidLatLng(lat, lng)) return;
      try {
        mapInstance.current.setView(sanitizeLatLngTuple(lat, lng), zoom, { animate: false });
      } catch {
        // Map may not be ready
      }
    },
    flyTo(lat: number, lng: number, zoom = 13) {
      if (!mapInstance.current || !isValidLatLng(lat, lng)) return;
      try {
        mapInstance.current.flyTo(sanitizeLatLngTuple(lat, lng), zoom, { duration: 0.6 });
      } catch {
        // Map may not be ready
      }
    },
  }));

  // ── Globe ↔ flat crossfade ────────────────────────────────────────────────
  // When switching globe→flat: fade Leaflet in (opacity 0→1, 300 ms CSS) while
  // the globe stays mounted beneath it, then unmount globe after transition.
  // When switching flat→globe: show globe immediately, fade Leaflet out.
  useEffect(() => {
    if (globeTimerRef.current !== null) {
      clearTimeout(globeTimerRef.current);
      globeTimerRef.current = null;
    }
    if (mapStyle === 'globe') {
      setShowGlobe(true);
      setLeafletReady(false);
    } else {
      setLeafletReady(true);
      // Ensure zoom ≥ 3 when returning to flat so the zoomend handler
      // doesn't immediately re-trigger the globe switch.
      if (mapInstance.current) {
        try {
          if (mapInstance.current.getZoom() < 3) {
            mapInstance.current.setZoom(3, { animate: false });
          }
        } catch { /* map may not be ready */ }
      }
      globeTimerRef.current = setTimeout(() => {
        setShowGlobe(false);
        globeTimerRef.current = null;
      }, 350);
    }
    return () => {
      if (globeTimerRef.current !== null) {
        clearTimeout(globeTimerRef.current);
        globeTimerRef.current = null;
      }
    };
  }, [mapStyle]);

  // ── Map initialisation (runs once) ───────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    // Expose L as window.L so leaflet.markercluster's UMD factory can find it
    // in bundled environments where the module scope has no implicit global.
    const win = window as Window & { L?: typeof L };
    if (!win.L) win.L = L;

    const initial = safeCenter(center);

    const MAP_INIT_OPTIONS: L.MapOptions = {
      zoomControl: false,
      attributionControl: true,
      // Prefer canvas renderer: faster for large marker counts.
      preferCanvas: true,
      // Required by leaflet.markercluster (spiderfyOnMaxZoom) — prevents
      // "Map has no maxZoom specified" crash when clusters are initialised.
      maxZoom: 19,
      // Zoom 2 is the minimum; reaching it triggers auto-switch to globe.
      minZoom: 2,
      // Prevent the world from repeating left/right when zoomed out.
      maxBounds: [[-90, -180], [90, 180]],
      maxBoundsViscosity: 1,
    };

    let map: L.Map;
    try {
      map = L.map(mapRef.current, MAP_INIT_OPTIONS).setView(initial, 14);
    } catch (err) {
      console.error('[MapView] Leaflet init error:', err);
      try {
        map = L.map(mapRef.current, MAP_INIT_OPTIONS).setView([...DEFAULT_CENTER], 14);
      } catch {
        return;
      }
    }

    map.attributionControl?.setPrefix(false);
    mapInstance.current = map;

    // Salon / live markers — regular group (counts stay low).
    salonLiveLayerRef.current = L.layerGroup().addTo(map);

    // Person markers — cluster group to avoid rendering 10 000 divIcons.
    // A try/catch protects against any runtime environment where the
    // leaflet.markercluster UMD failed to extend L (e.g., stale SW cache).
    let cluster: L.MarkerClusterGroup;
    try {
      cluster = L.markerClusterGroup({
        maxClusterRadius: 55,
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        chunkedLoading: true,
        iconCreateFunction: (c: L.MarkerCluster) => {
          const count = c.getChildCount();
          const size = count >= 100 ? 44 : count >= 20 ? 38 : 32;
          return L.divIcon({
            html: `<div class="map-cluster-icon" style="width:${size}px;height:${size}px">${count}</div>`,
            className: '',
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
          });
        },
      });
    } catch (clusterErr) {
      console.warn('[MapView] markerClusterGroup unavailable, falling back to LayerGroup:', clusterErr);
      cluster = L.layerGroup() as unknown as L.MarkerClusterGroup;
    }
    personClusterRef.current = cluster;
    cluster.addTo(map);

    capitalsLayerRef.current = L.layerGroup().addTo(map);

    const onMapClick = () => onMapBackgroundClickRef.current?.();
    map.on('click', onMapClick);

    // Auto-switch to globe when the user zooms out to the minimum (zoom ≤ 2).
    // Guard on mapStyleRef to avoid re-triggering when we're already on globe.
    const onZoomEnd = () => {
      setFlatMapZoom(map.getZoom());
      if (map.getZoom() <= 2 && mapStyleRef.current === 'flat') {
        onAutoSwitchToGlobeRef.current?.();
      }
    };
    map.on('zoomend', onZoomEnd);
    setFlatMapZoom(map.getZoom());

    const rafId = requestAnimationFrame(() => map.invalidateSize());
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(mapRef.current);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      map.off('click', onMapClick);
      map.off('zoomend', onZoomEnd);
      map.remove();
      mapInstance.current = null;
      salonLiveLayerRef.current = null;
      personClusterRef.current = null;
      capitalsLayerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tile layer swap on mapStyle change ──────────────────────────────────
  useEffect(() => {
    if (!mapInstance.current) return;
    if (tileLayerRef.current) {
      mapInstance.current.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }
    if (mapStyle === 'globe') return;
    const cfg = TILE_LAYERS[mapStyle];
    tileLayerRef.current = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: cfg.maxZoom,
      // Prevent the flat tile layer from repeating the world horizontally.
      noWrap: true,
    }).addTo(mapInstance.current);
  }, [mapStyle]);

  // ── Fly to new center ───────────────────────────────────────────────────
  useEffect(() => {
    if (!mapInstance.current) return;
    if (!isValidLatLng(center[0], center[1])) return;
    try {
      mapInstance.current.flyTo(sanitizeLatLngTuple(center[0], center[1]), 13, { duration: 0.6 });
    } catch (err) {
      console.error('[MapView] flyTo error:', err);
    }
  }, [center]);

  // ── User position marker (bonhomme bleu) ────────────────────────────────
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

  // ── World capital markers (flat map) ─────────────────────────────────────
  useEffect(() => {
    const layer = capitalsLayerRef.current;
    if (!layer) return;

    layer.clearLayers();
    if (mapStyle !== 'flat' || !leafletReady) return;

    const showLabels = flatMapZoom >= CAPITAL_LABEL_MIN_ZOOM;
    for (const cap of WORLD_CAPITALS) {
      if (!isValidLatLng(cap.lat, cap.lng)) continue;
      try {
        const marker = L.circleMarker([cap.lat, cap.lng], {
          radius: 3,
          color: 'rgba(190, 190, 255, 0.95)',
          fillColor: 'rgba(170, 170, 255, 0.8)',
          fillOpacity: 0.85,
          weight: 1,
          interactive: false,
        });
        marker.bindTooltip(
          `<span class="map-capital-label">${escapeHtml(cap.name)}</span>`,
          {
            permanent: showLabels,
            direction: 'top',
            offset: [0, -4],
            className: 'map-capital-tooltip',
          }
        );
        marker.addTo(layer);
      } catch (err) {
        console.error('[MapView] capital marker error:', err);
      }
    }
  }, [mapStyle, leafletReady, flatMapZoom]);

  // ── Marker update (salons, lives, people) ────────────────────────────────
  // IMPORTANT: callbacks (onSelectSalon, onSelectLive, onSelectPerson) are
  // accessed via stable refs so they are NOT listed as deps.  Without this,
  // every parent re-render would recreate 10 000+ markers because the parent
  // passes fresh arrow functions on every render.
  useEffect(() => {
    const salonLayer = salonLiveLayerRef.current;
    const personCluster = personClusterRef.current;
    if (!salonLayer || !personCluster) return;

    // ── Salons ──
    salonLayer.clearLayers();

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
        const m = L.marker([lat, lon], { icon }).addTo(salonLayer);
        m.on('click', (ev) => {
          L.DomEvent.stopPropagation(ev.originalEvent);
          onSelectSalonRef.current(s);
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
        const m = L.marker([lat, lon], { icon }).addTo(salonLayer);
        m.on('click', (ev) => {
          L.DomEvent.stopPropagation(ev.originalEvent);
          onSelectLiveRef.current(l);
        });
      } catch (err) {
        console.error('[MapView] live marker error:', err);
      }
    });

    // ── People (clustered, capped) ──
    personCluster.clearLayers();

    // Prioritise: live people first, then salon-hosts, then the rest.
    // Cap at MAX_PERSON_MARKERS to avoid freezing with 10 000 bots.
    const visiblePeople = people
      .filter((p) => isValidLatLng(p.latitude, p.longitude))
      .sort((a, b) => {
        const scoreA = (a.isLive ? 2 : 0) + (a.salonId ? 1 : 0);
        const scoreB = (b.isLive ? 2 : 0) + (b.salonId ? 1 : 0);
        return scoreB - scoreA;
      })
      .slice(0, MAX_PERSON_MARKERS);

    const batchMarkers: L.Marker[] = [];

    visiblePeople.forEach((p) => {
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
        const m = L.marker([lat, lon], { icon });
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
          onSelectPersonRef.current?.(p);
        });
        batchMarkers.push(m);
      } catch (err) {
        console.error('[MapView] person marker error:', err);
      }
    });

    // Add all person markers in one batch call for performance.
    if (batchMarkers.length > 0) {
      personCluster.addLayers(batchMarkers);
    }
  }, [salons, lives, people]); // callbacks accessed via stable refs — not listed as deps

  return (
    <div className="absolute inset-0 z-0">
      {/* Globe rendered first = below Leaflet in CSS stacking order.
          Kept mounted during crossfade; unmounted ~350 ms after switching to flat. */}
      {showGlobe && (
        <Suspense
          fallback={
            <div className="absolute inset-0 bg-[#060611] flex items-center justify-center">
              <span className="text-indigo-400/50 text-sm animate-pulse">
                Globe 3D en cours de chargement…
              </span>
            </div>
          }
        >
          <LazyGlobeView
            salons={salons}
            lives={lives}
            people={people}
            center={center}
            userPosition={userPosition}
            onSelectSalon={onSelectSalon}
            onSelectLive={onSelectLive}
            onSelectPerson={onSelectPerson}
            onZoomToFlat={onGlobeZoomToFlat}
          />
        </Suspense>
      )}

      {/* Leaflet flat map — always mounted to preserve its state.
          Rendered second = above the globe. Crossfades via opacity transition. */}
      <div
        ref={mapRef}
        className="absolute inset-0"
        style={{
          opacity: leafletReady ? 1 : 0,
          transition: 'opacity 300ms ease',
          pointerEvents: leafletReady ? undefined : 'none',
        }}
        data-map-style={mapStyle}
      />
    </div>
  );
});
