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

/** Video track must be enabled, live, and producing frames (not WebRTC-muted). */
export function isRelayVideoTrackReady(track: MediaStreamTrack): boolean {
  return track.kind === 'video' && track.readyState === 'live' && track.enabled && !track.muted;
}

/** Host stream must expose at least one producing video track before mesh offers. */
export function liveStreamReadyForRelay(stream: MediaStream | null | undefined): boolean {
  if (!stream) return false;
  return stream.getVideoTracks().some(isRelayVideoTrackReady);
}

/** Viewer stream must expose a live video track (audio-only ≠ vidéo connectée). */
export function hasLiveRelayVideoTrack(stream: MediaStream | null | undefined): boolean {
  if (!stream) return false;
  return stream.getVideoTracks().some((t) => t.readyState === 'live' && t.enabled);
}

/** Prefer VP8 over H264 for broader browser decode support. */
export function preferVp8VideoCodecPreferences(): RTCRtpCodec[] | null {
  if (typeof RTCRtpSender === 'undefined' || !RTCRtpSender.getCapabilities) return null;
  const codecs = RTCRtpSender.getCapabilities('video')?.codecs ?? [];
  if (!codecs.length) return null;
  const vp8 = codecs.filter((c) => c.mimeType.toLowerCase() === 'video/vp8');
  const h264 = codecs.filter((c) => c.mimeType.toLowerCase() === 'video/h264');
  const rest = codecs.filter((c) => !vp8.includes(c) && !h264.includes(c));
  return [...vp8, ...h264, ...rest];
}

/** Apply VP8-first codec preferences on all video transceivers in a peer connection. */
export function applyVp8VideoCodecPreferences(pc: RTCPeerConnection): void {
  const preferred = preferVp8VideoCodecPreferences();
  if (!preferred?.length) return;
  for (const transceiver of pc.getTransceivers()) {
    const kind = transceiver.sender.track?.kind ?? transceiver.receiver.track?.kind;
    if (kind !== 'video') continue;
    try {
      transceiver.setCodecPreferences(preferred);
    } catch {
      /* setCodecPreferences unsupported on some browsers */
    }
  }
}

/** Merge remote WebRTC tracks into one canonical stream (handles split ontrack events). */
export function mergeRemoteLiveStream(
  current: MediaStream | null,
  incoming: MediaStream,
  track: MediaStreamTrack
): MediaStream {
  const canonical = current ?? new MediaStream();
  for (const t of [...incoming.getTracks(), track]) {
    const sameKind = canonical.getTracks().find((x) => x.kind === t.kind && x.id !== t.id);
    if (sameKind) canonical.removeTrack(sameKind);
    if (!canonical.getTracks().some((x) => x.id === t.id)) {
      canonical.addTrack(t);
    }
  }
  return canonical;
}

/** Attach host camera/mic tracks with explicit sendonly transceivers (Unified Plan). */
export function attachLiveRelaySendTracks(pc: RTCPeerConnection, stream: MediaStream): void {
  for (const kind of ['video', 'audio'] as const) {
    const track = stream
      .getTracks()
      .find((t) =>
        kind === 'video'
          ? isRelayVideoTrackReady(t)
          : t.kind === kind && t.readyState === 'live' && t.enabled
      );
    if (!track) continue;

    const sender = pc.getSenders().find((s) => s.track?.kind === kind);
    if (sender) {
      void sender.replaceTrack(track);
      continue;
    }

    const transceiver = pc.getTransceivers().find((t) => {
      const mediaKind = t.receiver.track?.kind ?? t.sender.track?.kind;
      return mediaKind === kind || (mediaKind == null && t.direction.includes('send'));
    });

    if (transceiver) {
      void transceiver.sender.replaceTrack(track);
      if (kind === 'video') applyVp8VideoCodecPreferences(pc);
    } else {
      const added = pc.addTransceiver(track, { direction: 'sendonly', streams: [stream] });
      if (kind === 'video') {
        const preferred = preferVp8VideoCodecPreferences();
        if (preferred?.length) {
          try {
            added.setCodecPreferences(preferred);
          } catch {
            /* ignore */
          }
        }
      }
    }
  }
}
