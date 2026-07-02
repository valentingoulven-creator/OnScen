/** Popup global « connectez YouTube pour rejoindre un salon » (monté dans App). */

type GateListener = (open: boolean) => void;

let gateOpen = false;
const listeners = new Set<GateListener>();

function notify(): void {
  for (const fn of listeners) fn(gateOpen);
}

export function subscribeSalonYoutubeJoinGate(listener: GateListener): () => void {
  listeners.add(listener);
  listener(gateOpen);
  return () => listeners.delete(listener);
}

export function showSalonYoutubeJoinGate(): void {
  if (gateOpen) return;
  gateOpen = true;
  notify();
}

export function closeSalonYoutubeJoinGate(): void {
  if (!gateOpen) return;
  gateOpen = false;
  notify();
}

export function isSalonYoutubeJoinGateOpen(): boolean {
  return gateOpen;
}
