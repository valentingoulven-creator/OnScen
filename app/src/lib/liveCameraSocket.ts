import { emitOnSocket, onSocketConnect } from './socket';

export type LiveCameraTogglePayload = {
  liveId: string;
  active: boolean;
  mode?: 'camera' | 'file';
};

let pendingCameraToggle: LiveCameraTogglePayload | null = null;
let connectUnsub: (() => void) | null = null;

function flushPendingCameraToggle(): void {
  if (!pendingCameraToggle) return;
  emitOnSocket('live_camera_toggle', pendingCameraToggle);
}

function ensureConnectFlush(): void {
  if (connectUnsub) return;
  connectUnsub = onSocketConnect(flushPendingCameraToggle);
}

/**
 * Emit live_camera_toggle reliably — queues the last active state and re-sends on socket reconnect.
 */
export function emitLiveCameraToggle(
  liveId: string,
  active: boolean,
  mode?: 'camera' | 'file'
): void {
  const payload: LiveCameraTogglePayload = {
    liveId,
    active,
    mode: active ? mode : undefined,
  };
  if (active) {
    pendingCameraToggle = payload;
  } else {
    pendingCameraToggle = null;
  }
  ensureConnectFlush();
  emitOnSocket('live_camera_toggle', payload);
}

export function clearLiveCameraToggleQueue(liveId: string): void {
  if (pendingCameraToggle?.liveId === liveId) {
    pendingCameraToggle = null;
  }
}
