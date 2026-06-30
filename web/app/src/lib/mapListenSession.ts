/** Durée max d'écoute vidéo sur la fiche carte (petit salon) — conformité aperçu YouTube. */
export const MAP_INLINE_LISTEN_MAX_MS = 10 * 60 * 1000;

const sessions = new Map<string, number>();

/** Démarre ou reprend le chrono d'écoute carte pour ce salon (ne remonte pas le début si déjà actif). */
export function startMapInlineListenSession(salonId: string): void {
  if (!salonId) return;
  if (!sessions.has(salonId)) {
    sessions.set(salonId, Date.now());
  }
}

export function clearMapInlineListenSession(salonId: string): void {
  sessions.delete(salonId);
}

export function getMapInlineListenElapsedMs(salonId: string, now = Date.now()): number {
  const start = sessions.get(salonId);
  if (!start) return 0;
  return Math.max(0, now - start);
}

export function getMapInlineListenRemainingMs(salonId: string, now = Date.now()): number {
  const elapsed = getMapInlineListenElapsedMs(salonId, now);
  return Math.max(0, MAP_INLINE_LISTEN_MAX_MS - elapsed);
}

export function isMapInlineListenCapReached(salonId: string, now = Date.now()): boolean {
  return getMapInlineListenElapsedMs(salonId, now) >= MAP_INLINE_LISTEN_MAX_MS;
}
