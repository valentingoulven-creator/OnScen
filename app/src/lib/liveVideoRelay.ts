/** ICE servers : STUN public + TURN Soundy VPS (51.159.164.100). */
export const LIVE_WEBRTC_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  {
    urls: [
      'turn:51.159.164.100:3478?transport=udp',
      'turn:51.159.164.100:3478?transport=tcp',
    ],
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

export type LivePeerConnectionOptions = {
  /** Force TURN relay when direct / host candidates fail. */
  relayOnly?: boolean;
};

export function createLivePeerConnection(opts?: LivePeerConnectionOptions): RTCPeerConnection {
  return new RTCPeerConnection({
    iceServers: LIVE_WEBRTC_ICE_SERVERS,
    iceTransportPolicy: opts?.relayOnly ? 'relay' : 'all',
  });
}

/** Host stream must expose at least one live video track before mesh offers. */
export function liveStreamReadyForRelay(stream: MediaStream | null | undefined): boolean {
  if (!stream) return false;
  const videoLive = stream.getVideoTracks().some((t) => t.readyState === 'live' && t.enabled);
  if (!videoLive) return false;
  return true;
}

/** Attach host camera/mic tracks with explicit send transceivers (Unified Plan). */
export function attachLiveRelaySendTracks(pc: RTCPeerConnection, stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    if (track.readyState !== 'live' || !track.enabled) continue;
    const existing = pc
      .getSenders()
      .find((s) => s.track?.kind === track.kind && s.track?.id === track.id);
    if (existing) continue;
    const sender = pc.getSenders().find((s) => s.track?.kind === track.kind && !s.track);
    if (sender) {
      void sender.replaceTrack(track);
    } else {
      pc.addTrack(track, stream);
    }
  }
}
