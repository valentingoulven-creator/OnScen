/**
 * Globe 3D + pins démo pour la slide « Carte & globe » (présentation produit).
 * Marqueurs alignés sur l’app (overview live/salon, EventDayPinIcon, sponso ✨).
 */
import Globe from 'https://esm.sh/globe.gl@2.45.0?deps=three@0.180.0';

const TEXTURE_BASE = '../../backend/public/globe';
const EARTH_IMG = `${TEXTURE_BASE}/earth-blue-marble.jpg`;
const BUMP_IMG = `${TEXTURE_BASE}/earth-topology.png`;

const EVENT_PIN_PATH =
  'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z';

const EVENT_DAY_COLORS = ['#22c55e', '#3b82f6', '#f97316', '#8b5cf6'];

/** Pins démo · 4 types app (live, salon, event, sponsor). */
const DEMO_PINS = [
  { lat: 48.8566, lng: 2.3522, kind: 'live', title: 'Live · France' },
  { lat: 40.4168, lng: -3.7038, kind: 'event', eventDayIndex: 1, title: 'Événement · Espagne' },
  { lat: 60.1699, lng: 24.9384, kind: 'salon', title: 'Salon · Finlande' },
  { lat: 24.7136, lng: 46.6753, kind: 'sponsor', title: 'Sponsorisé · Arabie saoudite' },
  { lat: 6.5244, lng: 3.3792, kind: 'event', eventDayIndex: 0, title: 'Événement · Lagos' },
  { lat: 30.0444, lng: 31.2357, kind: 'live', title: 'Live · Le Caire' },
  { lat: -1.2921, lng: 36.8219, kind: 'salon', title: 'Salon · Nairobi' },
  { lat: -26.2041, lng: 28.0473, kind: 'event', eventDayIndex: 2, title: 'Événement · Johannesburg' },
  { lat: 41.9028, lng: 12.4964, kind: 'live', title: 'Live · Rome' },
  { lat: 45.4642, lng: 9.19, kind: 'salon', title: 'Salon · Milan' },
  { lat: 40.8518, lng: 14.2681, kind: 'event', eventDayIndex: 3, title: 'Événement · Naples' },
  { lat: 41.0082, lng: 28.9784, kind: 'live', title: 'Live · Istanbul' },
  { lat: 39.9334, lng: 32.8597, kind: 'event', eventDayIndex: 1, title: 'Événement · Ankara' },
  { lat: 38.4237, lng: 27.1428, kind: 'salon', title: 'Salon · Izmir' },
];

let globeInstance = null;
let mounted = false;

function buildSoundyPinHtml(d) {
  if (d.kind === 'live') {
    return `<div class="map-marker-overview-pin map-marker-overview-pin--live" role="presentation"><span class="map-marker-overview-dot live"></span></div>`;
  }
  if (d.kind === 'salon') {
    return `<div class="map-marker-overview-pin map-marker-overview-pin--salon" role="presentation"><span class="map-marker-overview-salon-badge">SALON</span><span class="map-marker-overview-dot salon"></span></div>`;
  }
  if (d.kind === 'sponsor') {
    return `<span class="globe-event-pin globe-event-pin--sponso" aria-hidden="true">✨</span>`;
  }
  const dayIdx = Math.max(0, Math.min(3, d.eventDayIndex ?? 0));
  const color = EVENT_DAY_COLORS[dayIdx];
  return `<svg class="globe-event-pin event-day-pin" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="${color}" stroke="#ffffff" stroke-width="1.25" d="${EVENT_PIN_PATH}"/></svg>`;
}

function pinElement(d) {
  const root = document.createElement('div');
  root.className = 'deck-globe-marker-host';
  root.setAttribute('role', 'img');
  root.setAttribute('aria-label', d.title);
  root.innerHTML = buildSoundyPinHtml(d);
  return root;
}

function readSize(container) {
  const stage = container.closest('.deck-globe-stage') ?? container.parentElement;
  const rect = (stage ?? container).getBoundingClientRect();
  const elRect = container.getBoundingClientRect();
  const rawW = elRect.width || rect.width || container.clientWidth || 400;
  const rawH = elRect.height || rect.height || container.clientHeight || 400;
  const side = Math.max(220, Math.round(Math.min(rawW, rawH) || rawW || 400));
  return { w: side, h: side };
}

function signalGlobeReady() {
  document.documentElement.classList.add('deck-globe-ready');
  window.__SOUNDY_DECK_GLOBE_READY__ = true;
  window.dispatchEvent(new Event('soundy-deck-globe-ready'));
}

function mountDeckGlobe(container) {
  if (mounted || !container) return;
  mounted = true;

  const { w, h } = readSize(container);

  const globe = Globe({
    animateIn: true,
    rendererConfig: { antialias: true, alpha: true, preserveDrawingBuffer: true },
  })(container)
    .width(w)
    .height(h)
    .backgroundColor('rgba(0,0,0,0)')
    .globeImageUrl(EARTH_IMG)
    .bumpImageUrl(BUMP_IMG)
    .showAtmosphere(true)
    .atmosphereColor('rgba(167, 139, 250, 0.35)')
    .atmosphereAltitude(0.22)
    .htmlElementsData(DEMO_PINS)
    .htmlLat((d) => d.lat)
    .htmlLng((d) => d.lng)
    .htmlAltitude(0.016)
    .htmlElement(pinElement);

  globe.controls().enableZoom = true;
  globe.controls().autoRotate = false;
  globe.pointOfView({ lat: 28, lng: 14, altitude: 2.45 }, 0);

  globeInstance = globe;

  const onResize = () => {
    const next = readSize(container);
    globe.width(next.w).height(next.h);
  };
  window.addEventListener('resize', onResize);

  let frames = 0;
  const waitFrames = () => {
    frames += 1;
    if (frames >= 48) {
      signalGlobeReady();
      return;
    }
    requestAnimationFrame(waitFrames);
  };
  requestAnimationFrame(waitFrames);
}

function shouldInitForPrint() {
  return Boolean(document.getElementById('print-deck'));
}

function scheduleGlobeMount(container) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => mountDeckGlobe(container));
  });
}

function bindSlideActivation(container) {
  document.addEventListener('soundy-deck-slide-change', (event) => {
    const idx = event.detail?.index;
    if (idx === 3) scheduleGlobeMount(container);
  });

  const slide = container.closest('.slide');
  if (slide?.classList.contains('is-active')) {
    scheduleGlobeMount(container);
  }
}

function init() {
  const container = document.getElementById('deck-globe');
  if (!container) return;

  if (shouldInitForPrint()) {
    scheduleGlobeMount(container);
    return;
  }

  bindSlideActivation(container);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
