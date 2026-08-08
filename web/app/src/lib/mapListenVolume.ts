const STORAGE_KEY = 'onscen_map_listen_volume';

export function getMapListenVolume(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const n = raw != null ? Number(raw) : 80;
    if (!Number.isFinite(n)) return 80;
    return Math.min(100, Math.max(0, Math.round(n)));
  } catch {
    return 80;
  }
}

export function setMapListenVolume(value: number): number {
  const v = Math.min(100, Math.max(0, Math.round(value)));
  try {
    localStorage.setItem(STORAGE_KEY, String(v));
  } catch {
    /* ignore */
  }
  return v;
}
