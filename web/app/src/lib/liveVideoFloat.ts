/** PiP vidéo live flottant — état global pour persister hors overlay plein écran. */

let floatActive = false;
const listeners = new Set<() => void>();

export function getLiveVideoFloatActive(): boolean {
  return floatActive;
}

export function setLiveVideoFloatActive(active: boolean): void {
  if (floatActive === active) return;
  floatActive = active;
  listeners.forEach((fn) => fn());
}

export function subscribeLiveVideoFloat(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Réduction imminente — activer le PiP vidéo dès que l'overlay plein écran se ferme. */
let minimizePipPending = false;

export function setLiveMinimizePipPending(pending: boolean): void {
  minimizePipPending = pending;
}

export function consumeLiveMinimizePipPending(): boolean {
  const pending = minimizePipPending;
  minimizePipPending = false;
  return pending;
}

/** Déclenché avant réduction du live plein écran (LivePage → auto float). */
export const LIVE_BEFORE_MINIMIZE_EVENT = 'soundy:live-before-minimize';

export function dispatchLiveBeforeMinimize(): void {
  setLiveMinimizePipPending(true);
  window.dispatchEvent(new CustomEvent(LIVE_BEFORE_MINIMIZE_EVENT));
}
