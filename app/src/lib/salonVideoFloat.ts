/** PiP vidéo salon flottant — état global pour persister hors overlay plein écran. */

let floatActive = false;
const listeners = new Set<() => void>();

export function getSalonVideoFloatActive(): boolean {
  return floatActive;
}

export function setSalonVideoFloatActive(active: boolean): void {
  if (floatActive === active) return;
  floatActive = active;
  listeners.forEach((fn) => fn());
}

export function subscribeSalonVideoFloat(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Déclenché avant réduction du salon plein écran (SalonPage → auto float). */
export const SALON_BEFORE_MINIMIZE_EVENT = 'soundy:salon-before-minimize';

export function dispatchSalonBeforeMinimize(): void {
  window.dispatchEvent(new CustomEvent(SALON_BEFORE_MINIMIZE_EVENT));
}
