import type { Live } from '../models/schema';

export type LiveWebrtcSignalType = 'offer' | 'answer' | 'ice';

export function validateLiveWebrtcViewerReady(
  live: Live | undefined,
  viewerId: string,
  viewerInRoom: boolean
): boolean {
  if (!live?.isActive || !live.cameraActive || !viewerInRoom) return false;
  if (live.cameraMode === 'file') return false;
  return viewerId !== live.hostId;
}

export function validateLiveWebrtcSignal(
  live: Live | undefined,
  senderId: string,
  toUserId: string,
  type: LiveWebrtcSignalType,
  senderInRoom: boolean
): boolean {
  if (!live?.isActive || !senderId || !toUserId || senderId === toUserId || !senderInRoom) {
    return false;
  }
  if (type === 'offer') {
    return senderId === live.hostId && toUserId !== live.hostId;
  }
  if (type === 'answer') {
    return toUserId === live.hostId && senderId !== live.hostId;
  }
  if (type === 'ice') {
    const hostToViewer = senderId === live.hostId && toUserId !== live.hostId;
    const viewerToHost = toUserId === live.hostId && senderId !== live.hostId;
    return hostToViewer || viewerToHost;
  }
  return false;
}
