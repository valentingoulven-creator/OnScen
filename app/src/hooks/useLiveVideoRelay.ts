import { useCallback, useEffect, useRef, useState } from 'react';
import { playLiveRemoteVideo } from '../lib/liveCameraSupport';
import {
  createLivePeerConnection,
  LIVE_WEBRTC_MESH_VIEWER_LIMIT,
  type LiveWebrtcSignalPayload,
} from '../lib/liveVideoRelay';
import { emitOnSocket, getSocket, onSocketConnect } from '../lib/socket';

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

  const isHost = !!(userId && hostId && userId === hostId);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingViewersRef = useRef<Set<string>>(new Set());
  const viewerPcRef = useRef<RTCPeerConnection | null>(null);
  const broadcastStreamRef = useRef(broadcastStream);
  broadcastStreamRef.current = broadcastStream;
  const cameraRelayActiveRef = useRef(cameraRelayActive);
  cameraRelayActiveRef.current = cameraRelayActive;

  const closePeer = useCallback((viewerId: string) => {
    const pc = peersRef.current.get(viewerId);
    if (!pc) return;
    pc.close();
    peersRef.current.delete(viewerId);
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
    el.srcObject = stream;
    await playLiveRemoteVideo(el);
  }, []);

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
    viewerPcRef.current?.close();
    viewerPcRef.current = null;
    remoteStreamRef.current = null;
    const el = viewerVideoRef.current;
    if (el) {
      el.srcObject = null;
    }
    setViewerStreamActive(false);
  }, []);

  const emitSignal = useCallback(
    (payload: Omit<LiveWebrtcSignalPayload, 'liveId'>) => {
      emitOnSocket('live_webrtc_signal', { liveId, ...payload });
    },
    [liveId]
  );

  const createOfferForViewer = useCallback(
    async (viewerId: string) => {
      const stream = broadcastStreamRef.current;
      if (!stream || !isHost) {
        if (isHost && cameraRelayActiveRef.current) {
          pendingViewersRef.current.add(viewerId);
        }
        return;
      }
      if (peersRef.current.size >= LIVE_WEBRTC_MESH_VIEWER_LIMIT) return;

      closePeer(viewerId);
      pendingViewersRef.current.delete(viewerId);
      const pc = createLivePeerConnection();
      for (const track of stream.getTracks()) {
        pc.addTrack(track, stream);
      }

      pc.onicecandidate = (ev) => {
        if (!ev.candidate) return;
        emitSignal({
          toUserId: viewerId,
          type: 'ice',
          data: ev.candidate.toJSON(),
        });
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          closePeer(viewerId);
        }
      };

      peersRef.current.set(viewerId, pc);

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        emitSignal({ toUserId: viewerId, type: 'offer', data: offer });
      } catch {
        closePeer(viewerId);
      }
    },
    [closePeer, emitSignal, isHost]
  );

  const handleHostAnswer = useCallback(
    async (viewerId: string, answer: RTCSessionDescriptionInit) => {
      const pc = peersRef.current.get(viewerId);
      if (!pc) return;
      try {
        await pc.setRemoteDescription(answer);
      } catch {
        closePeer(viewerId);
      }
    },
    [closePeer]
  );

  const handleHostIce = useCallback(
    async (viewerId: string, candidate: RTCIceCandidateInit) => {
      const pc = peersRef.current.get(viewerId);
      if (!pc) return;
      try {
        await pc.addIceCandidate(candidate);
      } catch {
        /* ignore stale candidates */
      }
    },
    []
  );

  const handleViewerOffer = useCallback(
    async (fromHostId: string, offer: RTCSessionDescriptionInit) => {
      if (isHost || fromHostId !== hostId) return;

      closeViewerPc();
      const pc = createLivePeerConnection();
      viewerPcRef.current = pc;

      pc.ontrack = (ev) => {
        const stream = resolveLiveRemoteStream(ev);
        if (!stream) return;
        remoteStreamRef.current = stream;
        setViewerStreamActive(true);
        setViewerRelayError(null);
        void attachViewerStream();
      };

      pc.onicecandidate = (ev) => {
        if (!ev.candidate || !hostId) return;
        emitSignal({
          toUserId: hostId,
          type: 'ice',
          data: ev.candidate.toJSON(),
        });
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') {
          setViewerRelayError('Connexion vidéo interrompue.');
          closeViewerPc();
        }
      };

      try {
        await pc.setRemoteDescription(offer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        emitSignal({ toUserId: fromHostId, type: 'answer', data: answer });
      } catch {
        closeViewerPc();
        setViewerRelayError('Impossible de recevoir le flux vidéo.');
      }
    },
    [attachViewerStream, closeViewerPc, emitSignal, hostId, isHost]
  );

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
    if (isHost || !cameraRelayActive) return;
    emitOnSocket('live_webrtc_viewer_ready', { liveId });
  }, [cameraRelayActive, isHost, liveId]);

  // Host: écoute les spectateurs prêts et les signaux WebRTC entrants
  useEffect(() => {
    if (!isHost || !userId) return;
    const socket = getSocket();
    if (!socket) return;

    const onViewerJoined = (payload: { liveId: string; viewerId: string }) => {
      if (payload.liveId !== liveId || !cameraRelayActive) return;
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
    cameraRelayActive,
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
    if (!cameraRelayActive || !broadcastStream) {
      pendingViewersRef.current.clear();
      closeAllPeers();
      return;
    }
    const pending = [...pendingViewersRef.current];
    pendingViewersRef.current.clear();
    for (const viewerId of pending) {
      void createOfferForViewer(viewerId);
    }
  }, [broadcastStream, cameraRelayActive, closeAllPeers, createOfferForViewer, isHost]);

  // Viewer: demande le flux quand la caméra host devient active (retry si l'hôte n'était pas prêt)
  useEffect(() => {
    if (isHost) return;
    if (!cameraRelayActive) {
      closeViewerPc();
      setViewerRelayError(null);
      return;
    }
    signalViewerReady();
    if (viewerStreamActive) return undefined;
    const retryId = window.setInterval(() => signalViewerReady(), 4000);
    return () => window.clearInterval(retryId);
  }, [cameraRelayActive, closeViewerPc, isHost, signalViewerReady, viewerStreamActive]);

  // Reconnexion socket : le spectateur redemande le flux ; l'hôte referme les pairs obsolètes
  useEffect(() => {
    if (!cameraRelayActive) return;
    const onReconnect = () => {
      if (isHost) {
        closeAllPeers();
      } else {
        closeViewerPc();
        signalViewerReady();
      }
    };
    return onSocketConnect(onReconnect);
  }, [
    cameraRelayActive,
    closeAllPeers,
    closeViewerPc,
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
    signalViewerReady,
  };
}
