import { useCallback, useEffect, useRef, useState } from 'react';
import { forceAttachLiveRemoteStream, playLiveRemoteVideo, unmuteLiveRemoteVideo } from '../lib/liveCameraSupport';
import {
  LIVE_CAMERA_VIEWER_ICE_FAILED,
  LIVE_CAMERA_VIEWER_TIMEOUT,
  LIVE_CAMERA_VIEWER_UNAVAILABLE,
} from '../lib/liveCameraMessages';
import {
  attachLiveRelaySendTracks,
  createLivePeerConnection,
  hasLiveRelayVideoTrack,
  liveStreamReadyForRelay,
  LIVE_WEBRTC_MESH_VIEWER_LIMIT,
  mergeRemoteLiveStream,
  type LiveWebrtcSignalPayload,
} from '../lib/liveVideoRelay';
import { emitOnSocket, getSocket, onSocketConnect } from '../lib/socket';

export type ViewerRelayPhase = 'idle' | 'waiting' | 'connecting' | 'connected' | 'failed';

const VIEWER_RELAY_TIMEOUT_MS = 45_000;
const VIEWER_READY_RETRY_MS = 2_000;
const VIEWER_MAX_READY_ATTEMPTS = 15;
const HOST_STREAM_WAIT_MS = 150;
const ICE_RETRY_RELAY_MS = 2_500;

type UseLiveVideoRelayOptions = {
  liveId: string;
  userId: string | undefined;
  hostId: string | undefined;
  /** Caméra réelle (getUserMedia) — pas le mode fichier local. */
  broadcastStream: MediaStream | null;
  cameraRelayActive: boolean;
};

function resolveLiveRemoteStream(ev: RTCTrackEvent): MediaStream | null {
  if (ev.streams[0]) return ev.streams[0];
  if (ev.track) return new MediaStream([ev.track]);
  return null;
}

function syncViewerStreamActive(
  stream: MediaStream | null,
  setActive: (active: boolean) => void
): boolean {
  const hasVideo = hasLiveRelayVideoTrack(stream);
  setActive(hasVideo);
  return hasVideo;
}

export function useLiveVideoRelay({
  liveId,
  userId,
  hostId,
  broadcastStream,
  cameraRelayActive,
}: UseLiveVideoRelayOptions) {
  const viewerVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const [viewerStreamActive, setViewerStreamActive] = useState(false);
  const [viewerRelayError, setViewerRelayError] = useState<string | null>(null);
  const [viewerRelayPhase, setViewerRelayPhase] = useState<ViewerRelayPhase>('idle');
  const [viewerAudioBlocked, setViewerAudioBlocked] = useState(false);
  const [viewerPlaybackBlocked, setViewerPlaybackBlocked] = useState(false);

  const isHost = !!(userId && hostId && userId === hostId);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const peerRelayOnlyRef = useRef<Map<string, boolean>>(new Map());
  const pendingViewersRef = useRef<Set<string>>(new Set());
  const viewerPcRef = useRef<RTCPeerConnection | null>(null);
  const viewerRelayOnlyRef = useRef(false);
  const pendingViewerOfferRef = useRef<{
    fromHostId: string;
    offer: RTCSessionDescriptionInit;
  } | null>(null);
  const broadcastStreamRef = useRef(broadcastStream);
  broadcastStreamRef.current = broadcastStream;
  const cameraRelayActiveRef = useRef(cameraRelayActive);
  cameraRelayActiveRef.current = cameraRelayActive;
  const hostIdRef = useRef(hostId);
  hostIdRef.current = hostId;
  const viewerReadyAttemptsRef = useRef(0);

  const closePeer = useCallback((viewerId: string) => {
    const pc = peersRef.current.get(viewerId);
    if (!pc) return;
    for (const sender of pc.getSenders()) {
      if (sender.track) void sender.replaceTrack(null);
    }
    pc.close();
    peersRef.current.delete(viewerId);
    peerRelayOnlyRef.current.delete(viewerId);
  }, []);

  const closeAllPeers = useCallback(() => {
    for (const viewerId of [...peersRef.current.keys()]) {
      closePeer(viewerId);
    }
  }, [closePeer]);

  const attachViewerStream = useCallback(async () => {
    const stream = remoteStreamRef.current;
    const el = viewerVideoRef.current;
    if (!stream || !el) return;
    if (!hasLiveRelayVideoTrack(stream)) {
      syncViewerStreamActive(stream, setViewerStreamActive);
      return;
    }
    forceAttachLiveRemoteStream(el, stream);
    const result = await playLiveRemoteVideo(el);
    setViewerAudioBlocked(result === 'muted_fallback');
    setViewerPlaybackBlocked(result === 'failed');
    if (result === 'failed') {
      for (const track of stream.getVideoTracks()) {
        const retry = () => {
          track.removeEventListener('unmute', retry);
          void attachViewerStream();
        };
        track.addEventListener('unmute', retry);
      }
    }
  }, []);

  const enableViewerAudio = useCallback(async () => {
    const el = viewerVideoRef.current;
    if (!el) return false;
    const ok = await unmuteLiveRemoteVideo(el, remoteStreamRef.current);
    if (ok) {
      setViewerAudioBlocked(false);
      setViewerPlaybackBlocked(false);
    }
    return ok;
  }, []);

  const enableViewerPlayback = useCallback(async () => {
    const el = viewerVideoRef.current;
    const stream = remoteStreamRef.current;
    if (!el || !stream) return false;
    if (hasLiveRelayVideoTrack(stream)) {
      forceAttachLiveRemoteStream(el, stream);
    }
    const ok = await enableViewerAudio();
    if (!ok) {
      try {
        el.muted = false;
        await el.play();
        setViewerPlaybackBlocked(false);
        setViewerAudioBlocked(false);
        return true;
      } catch {
        return false;
      }
    }
    setViewerPlaybackBlocked(false);
    return ok;
  }, [enableViewerAudio]);

  const setViewerVideoRef = useCallback(
    (el: HTMLVideoElement | null) => {
      viewerVideoRef.current = el;
      if (el && remoteStreamRef.current) {
        void attachViewerStream();
      }
    },
    [attachViewerStream]
  );

  const closeViewerPc = useCallback(() => {
    const pc = viewerPcRef.current;
    if (pc) {
      for (const sender of pc.getSenders()) {
        if (sender.track) void sender.replaceTrack(null);
      }
      pc.close();
    }
    viewerPcRef.current = null;
    viewerRelayOnlyRef.current = false;
    remoteStreamRef.current = null;
    const el = viewerVideoRef.current;
    if (el) {
      el.srcObject = null;
    }
    setViewerStreamActive(false);
    setViewerAudioBlocked(false);
    setViewerPlaybackBlocked(false);
  }, []);

  const emitSignal = useCallback(
    (payload: Omit<LiveWebrtcSignalPayload, 'liveId'>) => {
      emitOnSocket('live_webrtc_signal', { liveId, ...payload });
    },
    [liveId]
  );

  const markViewerFailed = useCallback(
    (message: string) => {
      setViewerRelayPhase('failed');
      setViewerRelayError(message);
      closeViewerPc();
    },
    [closeViewerPc]
  );

  const waitForHostStream = useCallback(async (): Promise<MediaStream | null> => {
    for (let i = 0; i < 40; i++) {
      const stream = broadcastStreamRef.current;
      if (liveStreamReadyForRelay(stream)) return stream;
      await new Promise<void>((resolve) => window.setTimeout(resolve, HOST_STREAM_WAIT_MS));
    }
    return liveStreamReadyForRelay(broadcastStreamRef.current)
      ? broadcastStreamRef.current
      : null;
  }, []);

  const createOfferForViewer = useCallback(
    async (viewerId: string, relayOnly = false) => {
      if (!isHost) return;
      pendingViewersRef.current.add(viewerId);

      const stream = await waitForHostStream();
      if (!stream || !isHost) {
        return;
      }
      if (peersRef.current.size >= LIVE_WEBRTC_MESH_VIEWER_LIMIT) {
        pendingViewersRef.current.delete(viewerId);
        return;
      }

      pendingViewersRef.current.delete(viewerId);
      closePeer(viewerId);
      const pc = createLivePeerConnection({ relayOnly });
      attachLiveRelaySendTracks(pc, stream);
      peerRelayOnlyRef.current.set(viewerId, relayOnly);

      pc.onicecandidate = (ev) => {
        if (!ev.candidate) return;
        emitSignal({
          toUserId: viewerId,
          type: 'ice',
          data: ev.candidate.toJSON(),
        });
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') {
          if (!peerRelayOnlyRef.current.get(viewerId)) {
            window.setTimeout(() => {
              if (peersRef.current.get(viewerId) === pc) {
                void createOfferForViewer(viewerId, true);
              }
            }, ICE_RETRY_RELAY_MS);
            return;
          }
          closePeer(viewerId);
        } else if (pc.connectionState === 'closed') {
          closePeer(viewerId);
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'failed' && !peerRelayOnlyRef.current.get(viewerId)) {
          window.setTimeout(() => {
            if (peersRef.current.get(viewerId) === pc) {
              void createOfferForViewer(viewerId, true);
            }
          }, ICE_RETRY_RELAY_MS);
        }
      };

      peersRef.current.set(viewerId, pc);

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        emitSignal({ toUserId: viewerId, type: 'offer', data: offer });
      } catch {
        closePeer(viewerId);
        pendingViewersRef.current.add(viewerId);
      }
    },
    [closePeer, emitSignal, isHost, waitForHostStream]
  );

  const flushPendingViewers = useCallback(() => {
    if (!isHost || !cameraRelayActiveRef.current) return;
    const pending = [...pendingViewersRef.current];
    if (!pending.length) return;
    if (!liveStreamReadyForRelay(broadcastStreamRef.current)) return;
    pendingViewersRef.current.clear();
    for (const viewerId of pending) {
      void createOfferForViewer(viewerId);
    }
  }, [createOfferForViewer, isHost]);

  const handleHostAnswer = useCallback(
    async (viewerId: string, answer: RTCSessionDescriptionInit) => {
      const pc = peersRef.current.get(viewerId);
      if (!pc) return;
      try {
        await pc.setRemoteDescription(answer);
      } catch {
        closePeer(viewerId);
        pendingViewersRef.current.add(viewerId);
        void createOfferForViewer(viewerId, peerRelayOnlyRef.current.get(viewerId) ?? false);
      }
    },
    [closePeer, createOfferForViewer]
  );

  const handleHostIce = useCallback(async (viewerId: string, candidate: RTCIceCandidateInit) => {
    const pc = peersRef.current.get(viewerId);
    if (!pc) return;
    try {
      await pc.addIceCandidate(candidate);
    } catch {
      /* ignore stale candidates */
    }
  }, []);

  const replaceHostTrack = useCallback(
    async (track: MediaStreamTrack) => {
      if (!isHost) return;
      const replacements: Promise<void>[] = [];
      for (const pc of peersRef.current.values()) {
        const sender = pc.getSenders().find((s) => s.track?.kind === track.kind);
        if (sender) replacements.push(sender.replaceTrack(track));
        else if (broadcastStreamRef.current) {
          pc.addTrack(track, broadcastStreamRef.current);
        }
      }
      await Promise.all(replacements);
    },
    [isHost]
  );

  const applyViewerOffer = useCallback(
    async (fromHostId: string, offer: RTCSessionDescriptionInit, relayOnly = false) => {
      if (isHost) return;
      const expectedHostId = hostIdRef.current;
      if (expectedHostId && fromHostId !== expectedHostId) return;

      closeViewerPc();
      setViewerRelayPhase('connecting');
      setViewerRelayError(null);
      viewerReadyAttemptsRef.current = 0;
      viewerRelayOnlyRef.current = relayOnly;

      const pc = createLivePeerConnection({ relayOnly });
      viewerPcRef.current = pc;

      pc.ontrack = (ev) => {
        const incoming = resolveLiveRemoteStream(ev);
        if (!incoming) return;
        remoteStreamRef.current = mergeRemoteLiveStream(
          remoteStreamRef.current,
          incoming,
          ev.track
        );
        const hasVideo = syncViewerStreamActive(remoteStreamRef.current, setViewerStreamActive);
        if (hasVideo) {
          setViewerRelayPhase('connected');
          setViewerRelayError(null);
          void attachViewerStream();
        }
      };

      pc.onicecandidate = (ev) => {
        if (!ev.candidate) return;
        emitSignal({
          toUserId: fromHostId,
          type: 'ice',
          data: ev.candidate.toJSON(),
        });
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') {
          if (!viewerRelayOnlyRef.current) {
            window.setTimeout(() => {
              if (viewerPcRef.current === pc) {
                void applyViewerOffer(fromHostId, offer, true);
              }
            }, ICE_RETRY_RELAY_MS);
            return;
          }
          markViewerFailed(LIVE_CAMERA_VIEWER_ICE_FAILED);
        } else if (pc.connectionState === 'disconnected') {
          window.setTimeout(() => {
            if (viewerPcRef.current === pc && pc.connectionState === 'disconnected') {
              markViewerFailed(LIVE_CAMERA_VIEWER_UNAVAILABLE);
            }
          }, 5000);
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'failed') {
          if (!viewerRelayOnlyRef.current) {
            window.setTimeout(() => {
              if (viewerPcRef.current === pc) {
                void applyViewerOffer(fromHostId, offer, true);
              }
            }, ICE_RETRY_RELAY_MS);
            return;
          }
          markViewerFailed(LIVE_CAMERA_VIEWER_ICE_FAILED);
        }
      };

      try {
        await pc.setRemoteDescription(offer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        emitSignal({ toUserId: fromHostId, type: 'answer', data: answer });
      } catch {
        markViewerFailed(LIVE_CAMERA_VIEWER_UNAVAILABLE);
      }
    },
    [attachViewerStream, closeViewerPc, emitSignal, isHost, markViewerFailed]
  );

  const handleViewerOffer = useCallback(
    async (fromHostId: string, offer: RTCSessionDescriptionInit) => {
      if (isHost) return;
      const expectedHostId = hostIdRef.current;
      if (expectedHostId && fromHostId !== expectedHostId) return;
      if (!expectedHostId) {
        pendingViewerOfferRef.current = { fromHostId, offer };
        setViewerRelayPhase('connecting');
        return;
      }
      await applyViewerOffer(fromHostId, offer);
    },
    [applyViewerOffer, isHost]
  );

  useEffect(() => {
    const pending = pendingViewerOfferRef.current;
    if (!pending || isHost || !hostId) return;
    if (pending.fromHostId !== hostId) {
      pendingViewerOfferRef.current = null;
      return;
    }
    pendingViewerOfferRef.current = null;
    void applyViewerOffer(pending.fromHostId, pending.offer);
  }, [applyViewerOffer, hostId, isHost]);

  const handleViewerIce = useCallback(async (candidate: RTCIceCandidateInit) => {
    const pc = viewerPcRef.current;
    if (!pc) return;
    try {
      await pc.addIceCandidate(candidate);
    } catch {
      /* ignore */
    }
  }, []);

  const signalViewerReady = useCallback(() => {
    if (isHost || !cameraRelayActiveRef.current) return;
    viewerReadyAttemptsRef.current += 1;
    if (viewerReadyAttemptsRef.current > VIEWER_MAX_READY_ATTEMPTS) {
      markViewerFailed(LIVE_CAMERA_VIEWER_UNAVAILABLE);
      return;
    }
    setViewerRelayPhase((prev) => (prev === 'connected' ? prev : 'waiting'));
    emitOnSocket('live_webrtc_viewer_ready', { liveId });
  }, [isHost, liveId, markViewerFailed]);

  // Host: écoute les spectateurs prêts et les signaux WebRTC entrants
  useEffect(() => {
    if (!isHost || !userId) return;
    const socket = getSocket();
    if (!socket) return;

    const onViewerJoined = (payload: { liveId: string; viewerId: string }) => {
      if (payload.liveId !== liveId) return;
      void createOfferForViewer(payload.viewerId);
    };

    const onSignal = (payload: LiveWebrtcSignalPayload & { fromUserId: string }) => {
      if (payload.liveId !== liveId || payload.toUserId !== userId) return;
      if (payload.type === 'answer') {
        void handleHostAnswer(payload.fromUserId, payload.data as RTCSessionDescriptionInit);
      } else if (payload.type === 'ice') {
        void handleHostIce(payload.fromUserId, payload.data as RTCIceCandidateInit);
      }
    };

    const onViewerLeft = (payload: { liveId: string; viewerId: string }) => {
      if (payload.liveId !== liveId) return;
      closePeer(payload.viewerId);
      pendingViewersRef.current.delete(payload.viewerId);
    };

    socket.on('live_webrtc_viewer_joined', onViewerJoined);
    socket.on('live_webrtc_signal', onSignal);
    socket.on('live_webrtc_viewer_left', onViewerLeft);

    return () => {
      socket.off('live_webrtc_viewer_joined', onViewerJoined);
      socket.off('live_webrtc_signal', onSignal);
      socket.off('live_webrtc_viewer_left', onViewerLeft);
    };
  }, [
    closePeer,
    createOfferForViewer,
    handleHostAnswer,
    handleHostIce,
    isHost,
    liveId,
    userId,
  ]);

  // Viewer: écoute les offres du host
  useEffect(() => {
    if (isHost || !userId) return;
    const socket = getSocket();
    if (!socket) return;

    const onSignal = (payload: LiveWebrtcSignalPayload & { fromUserId: string }) => {
      if (payload.liveId !== liveId || payload.toUserId !== userId) return;
      if (payload.type === 'offer') {
        void handleViewerOffer(payload.fromUserId, payload.data as RTCSessionDescriptionInit);
      } else if (payload.type === 'ice') {
        void handleViewerIce(payload.data as RTCIceCandidateInit);
      }
    };

    socket.on('live_webrtc_signal', onSignal);
    return () => {
      socket.off('live_webrtc_signal', onSignal);
    };
  }, [handleViewerIce, handleViewerOffer, isHost, liveId, userId]);

  // Host: démarre / arrête le broadcast quand le flux caméra change
  useEffect(() => {
    if (!isHost) return;
    if (!cameraRelayActive || !liveStreamReadyForRelay(broadcastStream)) {
      pendingViewersRef.current.clear();
      closeAllPeers();
      return;
    }
    flushPendingViewers();
  }, [broadcastStream, cameraRelayActive, closeAllPeers, flushPendingViewers, isHost]);

  // Viewer: demande le flux quand la caméra host devient active (retry si l'hôte n'était pas prêt)
  useEffect(() => {
    if (isHost) return;
    if (!cameraRelayActive) {
      closeViewerPc();
      setViewerRelayError(null);
      setViewerRelayPhase('idle');
      viewerReadyAttemptsRef.current = 0;
      pendingViewerOfferRef.current = null;
      return;
    }
    signalViewerReady();
    if (viewerStreamActive) return undefined;
    const retryId = window.setInterval(() => signalViewerReady(), VIEWER_READY_RETRY_MS);
    return () => window.clearInterval(retryId);
  }, [cameraRelayActive, closeViewerPc, isHost, signalViewerReady, viewerStreamActive]);

  // Viewer: timeout si aucun flux reçu
  useEffect(() => {
    if (isHost || !cameraRelayActive || viewerStreamActive) return;
    if (viewerRelayPhase === 'failed') return;
    const timeoutId = window.setTimeout(() => {
      if (!viewerStreamActive) {
        markViewerFailed(LIVE_CAMERA_VIEWER_TIMEOUT);
      }
    }, VIEWER_RELAY_TIMEOUT_MS);
    return () => window.clearTimeout(timeoutId);
  }, [
    cameraRelayActive,
    isHost,
    markViewerFailed,
    viewerRelayPhase,
    viewerStreamActive,
  ]);

  // Reconnexion socket : le spectateur redemande le flux ; l'hôte referme les pairs obsolètes
  useEffect(() => {
    if (!cameraRelayActive) return;
    const onReconnect = () => {
      if (isHost) {
        closeAllPeers();
        flushPendingViewers();
      } else {
        closeViewerPc();
        viewerReadyAttemptsRef.current = 0;
        pendingViewerOfferRef.current = null;
        setViewerRelayPhase('waiting');
        setViewerRelayError(null);
        signalViewerReady();
      }
    };
    return onSocketConnect(onReconnect);
  }, [
    cameraRelayActive,
    closeAllPeers,
    closeViewerPc,
    flushPendingViewers,
    isHost,
    signalViewerReady,
  ]);

  useEffect(() => {
    return () => {
      closeAllPeers();
      closeViewerPc();
    };
  }, [closeAllPeers, closeViewerPc]);

  return {
    viewerVideoRef: setViewerVideoRef,
    viewerStreamActive,
    viewerRelayError,
    viewerRelayPhase,
    viewerAudioBlocked,
    viewerPlaybackBlocked,
    enableViewerAudio,
    enableViewerPlayback,
    signalViewerReady,
    replaceHostTrack,
    releaseRelayConnections: closeAllPeers,
  };
}
