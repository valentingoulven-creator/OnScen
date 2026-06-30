import type { MapViewHandle } from '../components/MapView';

function isHandleReady(handle: MapViewHandle | null): handle is MapViewHandle {
  return handle != null && handle.isMapReady();
}

/** Attend que la ref carte Leaflet soit prête (montage lazy / changement d'onglet). */
export function scheduleMapFlyWhenReady(
  getHandle: () => MapViewHandle | null,
  fly: (handle: MapViewHandle) => void,
  opts?: { maxAttempts?: number; intervalMs?: number }
): () => void {
  let cancelled = false;
  let attempts = 0;
  const maxAttempts = opts?.maxAttempts ?? 80;
  const intervalMs = opts?.intervalMs ?? 50;

  const tryFly = () => {
    if (cancelled) return;
    const handle = getHandle();
    if (isHandleReady(handle)) {
      fly(handle);
      return;
    }
    attempts += 1;
    if (attempts < maxAttempts) {
      window.setTimeout(tryFly, intervalMs);
    }
  };

  requestAnimationFrame(() => requestAnimationFrame(tryFly));

  return () => {
    cancelled = true;
  };
}
