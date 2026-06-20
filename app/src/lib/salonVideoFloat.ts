/** PiP vidéo salon flottant — état global pour persister hors overlay plein écran. */

const SALON_OPEN_INTENT_KEY = 'soundy.salon_open_intent';

let floatActive = false;
const listeners = new Set<() => void>();

/** Navigation carte → salon plein écran (empêche PiP auto et downgrade minimized). */
export type SalonOpenIntent = 'full';

export function setSalonOpenIntent(intent: SalonOpenIntent): void {
  try {
    sessionStorage.setItem(SALON_OPEN_INTENT_KEY, intent);
  } catch {
    /* private mode — in-memory only via openSalonPage viewMode */
  }
}

export function peekSalonOpenIntent(): SalonOpenIntent | null {
  try {
    const v = sessionStorage.getItem(SALON_OPEN_INTENT_KEY);
    return v === 'full' ? 'full' : null;
  } catch {
    return null;
  }
}

export function consumeSalonOpenIntent(): SalonOpenIntent | null {
  const intent = peekSalonOpenIntent();
  if (!intent) return null;
  try {
    sessionStorage.removeItem(SALON_OPEN_INTENT_KEY);
  } catch {
    /* ignore */
  }
  return intent;
}

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

/** Réduction imminente — activer le PiP vidéo dès que l'overlay plein écran se ferme. */
let minimizePipPending = false;

export function setSalonMinimizePipPending(pending: boolean): void {
  minimizePipPending = pending;
}

export function consumeSalonMinimizePipPending(): boolean {
  const pending = minimizePipPending;
  minimizePipPending = false;
  return pending;
}

/** Déclenché avant réduction du salon plein écran (SalonPage → auto float). */
export const SALON_BEFORE_MINIMIZE_EVENT = 'soundy:salon-before-minimize';

export function dispatchSalonBeforeMinimize(): void {
  setSalonMinimizePipPending(true);
  window.dispatchEvent(new CustomEvent(SALON_BEFORE_MINIMIZE_EVENT));
}

/** Salon à ouvrir en PiP flottant (clic sidebar carte : live, salon, profil en direct). */
let openSalonPipIntentSalonId: string | null = null;

export function setOpenSalonPipIntent(salonId: string): void {
  openSalonPipIntentSalonId = salonId;
}

export function getOpenSalonPipIntent(): string | null {
  return openSalonPipIntentSalonId;
}

export function clearOpenSalonPipIntent(): void {
  openSalonPipIntentSalonId = null;
}

export const SALON_OPEN_PIP_EVENT = 'soundy:open-salon-pip';

export function dispatchOpenSalonPip(): void {
  window.dispatchEvent(new CustomEvent(SALON_OPEN_PIP_EVENT));
}
