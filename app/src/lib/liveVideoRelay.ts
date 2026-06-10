/** ICE servers : STUN public + TURN Soundy VPS (51.159.164.100). */
export const LIVE_WEBRTC_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  {
    urls: 'turn:51.159.164.100:3478',
    username: 'soundy',
    credential: 'TurnSoundy2026!',
  },
];

/** Limite pratique du mesh hôte→N spectateurs (bande passante upload hôte). */
export const LIVE_WEBRTC_MESH_VIEWER_LIMIT = 30;

export type LiveWebrtcSignalType = 'offer' | 'answer' | 'ice';

export interface LiveWebrtcSignalPayload {
  liveId: string;
  toUserId: string;
  type: LiveWebrtcSignalType;
  data: RTCSessionDescriptionInit | RTCIceCandidateInit;
}

export function createLivePeerConnection(): RTCPeerConnection {
  return new RTCPeerConnection({ iceServers: LIVE_WEBRTC_ICE_SERVERS });
}
