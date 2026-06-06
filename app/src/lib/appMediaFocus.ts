/** Which surface may drive audible playback (one primary at a time). */
export type AppMediaOwner = 'reels' | 'salon' | 'live';

type Listener = (owner: AppMediaOwner | null) => void;

let currentOwner: AppMediaOwner | null = null;
const listeners = new Set<Listener>();

export function getAppMediaOwner(): AppMediaOwner | null {
  return currentOwner;
}

export function requestAppMediaFocus(owner: AppMediaOwner): void {
  if (currentOwner === owner) return;
  currentOwner = owner;
  listeners.forEach((fn) => fn(currentOwner));
}

export function releaseAppMediaFocus(owner: AppMediaOwner): void {
  if (currentOwner !== owner) return;
  currentOwner = null;
  listeners.forEach((fn) => fn(null));
}

export function subscribeAppMediaFocus(listener: Listener): () => void {
  listeners.add(listener);
  listener(currentOwner);
  return () => listeners.delete(listener);
}
