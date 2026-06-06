export type PlaybackCommandHandlers = {
  play?: () => void;
  pause?: () => void;
};

let handlers: PlaybackCommandHandlers | null = null;
let actionsRegistered = false;

function registerMediaSessionActions(): void {
  if (actionsRegistered || !('mediaSession' in navigator)) return;
  actionsRegistered = true;
  try {
    navigator.mediaSession.setActionHandler('play', () => {
      handlers?.play?.();
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      handlers?.pause?.();
    });
  } catch {
    /* certains navigateurs n’acceptent pas toutes les actions */
  }
}

export function setMediaSessionHandlers(next: PlaybackCommandHandlers | null): void {
  handlers = next;
  if (next) registerMediaSessionActions();
}
