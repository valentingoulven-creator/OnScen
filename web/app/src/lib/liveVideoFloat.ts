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
export const LIVE_BEFORE_MINIMIZE_EVENT = 'onscen:live-before-minimize';

export function dispatchLiveBeforeMinimize(): void {
  setLiveMinimizePipPending(true);
  window.dispatchEvent(new CustomEvent(LIVE_BEFORE_MINIMIZE_EVENT));
}

/** Pause locale du flux viewer (PiP / plein écran) — n'affecte pas le host. */
let viewerPlaybackPaused = false;
const pauseListeners = new Set<() => void>();

export function getLiveViewerPlaybackPaused(): boolean {
  return viewerPlaybackPaused;
}

export function setLiveViewerPlaybackPaused(paused: boolean): void {
  if (viewerPlaybackPaused === paused) return;
  viewerPlaybackPaused = paused;
  pauseListeners.forEach((fn) => fn());
}

export function toggleLiveViewerPlaybackPaused(): boolean {
  setLiveViewerPlaybackPaused(!viewerPlaybackPaused);
  return viewerPlaybackPaused;
}

export function subscribeLiveViewerPlaybackPaused(listener: () => void): () => void {
  pauseListeners.add(listener);
  return () => pauseListeners.delete(listener);
}
