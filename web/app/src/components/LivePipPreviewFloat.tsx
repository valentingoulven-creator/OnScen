/** Floating PiP preview for a live stream (HLS/WebRTC) — no join, no socket. */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  useDraggableVideoPip,
  defaultVideoPipPos,
  VIDEO_PIP_WIDTH,
  VIDEO_PIP_HEADER_HEIGHT,
} from './DraggableVideoPip';
import { FollowUserButton } from './FollowUserButton';
import { useAuth } from '../context/AuthContext';
import { useCloudflareHlsPlayback } from '../hooks/useCloudflareHlsPlayback';
import { api } from '../lib/api';
import type { Live } from '../types';

function LivePipPreviewFloatInner({
  live,
  onJoin,
  onClose,
}: {
  live: Live;
  onJoin: () => void;
  onClose: () => void;
}) {
  const { token } = useAuth();
  const pip = useDraggableVideoPip(true, onClose, defaultVideoPipPos, live.id);
  const videoH = Math.round((VIDEO_PIP_WIDTH * 9) / 16);
  const [hostFollowing, setHostFollowing] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void api.getMyFollowing(token).then((r) => {
      if (!cancelled) setHostFollowing(r.followingIds.includes(live.hostId));
    });
    return () => {
      cancelled = true;
    };
  }, [token, live.hostId]);

  const isCloudflare = live.streamMode === 'cloudflare';
  const hls = useCloudflareHlsPlayback({
    playbackUrl: isCloudflare ? (live.cloudflarePlaybackUrl ?? null) : null,
    active: isCloudflare,
  });

  const albumArtUrl = live.playbackState.albumArtUrl;

  return createPortal(
    <div
      className="pointer-events-auto fixed rounded-xl overflow-hidden shadow-2xl border border-[#2a2a3a] bg-[#0b0b0f]"
      style={{ left: pip.position.x, top: pip.position.y, width: VIDEO_PIP_WIDTH, zIndex: 99999 }}
    >
      {/* Draggable header */}
      <div
        className="flex items-center gap-1.5 px-2 border-b border-[#2a2a36] bg-[#14141c]/95 cursor-grab active:cursor-grabbing select-none touch-none"
        style={{ height: VIDEO_PIP_HEADER_HEIGHT }}
        onPointerDown={pip.onHeaderPointerDown}
      >
        <span className="text-[10px] text-red-400/80 leading-none shrink-0" aria-hidden>⠿</span>
        <p className="flex-1 truncate min-w-0 text-[9px] font-bold text-red-400 uppercase tracking-widest">
          {live.title}
        </p>
        <div
          className="shrink-0 inline-flex items-center self-center"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <FollowUserButton
            userId={live.hostId}
            username={live.hostName}
            initialFollowing={hostFollowing}
            relatedLive={live}
            iconOnly
            iconStyle="heart"
            pipHeader
            onFollowingChange={setHostFollowing}
          />
        </div>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onJoin}
          className="shrink-0 px-2 py-0.5 rounded text-[9px] bg-red-600 hover:bg-red-500 text-white transition"
          title="Rejoindre le live"
        >
          Rejoindre
        </button>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onClose}
          className="shrink-0 w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-white hover:bg-white/10 transition text-xs"
          aria-label="Fermer la prévisualisation"
        >
          ×
        </button>
      </div>

      {/* Video / placeholder */}
      {isCloudflare ? (
        <div className="relative bg-black" style={{ width: VIDEO_PIP_WIDTH, height: videoH }}>
          {/* HLS video always mounted so the ref callback can attach */}
          <video
            ref={hls.hlsVideoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full live-cloudflare-stage-video"
            style={{ opacity: hls.hlsStreamActive ? 1 : 0 }}
          />
          {!hls.hlsStreamActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-gray-500">
              {albumArtUrl ? (
                <img src={albumArtUrl} alt="" className="w-10 h-10 rounded-lg object-cover opacity-60" />
              ) : (
                <span className="text-xl">📡</span>
              )}
              <p className="text-[10px]">
                {hls.hlsPhase === 'error' ? 'Flux indisponible' : 'Connexion…'}
              </p>
            </div>
          )}
          {hls.hlsPlaybackBlocked && hls.hlsStreamActive && (
            <button
              type="button"
              onClick={() => void hls.enableHlsPlayback()}
              className="absolute inset-0 flex items-center justify-center bg-black/60 text-white"
            >
              <span className="text-2xl">▶</span>
            </button>
          )}
        </div>
      ) : (
        /* WebRTC / unknown — no preview without joining */
        <div
          className="flex flex-col items-center justify-center gap-1.5 bg-black"
          style={{ width: VIDEO_PIP_WIDTH, height: videoH }}
        >
          {albumArtUrl ? (
            <img src={albumArtUrl} alt="" className="w-12 h-12 rounded-xl object-cover opacity-70" />
          ) : (
            <span className="text-2xl">📡</span>
          )}
          <p className="text-[10px] text-gray-500 text-center px-3">
            Rejoignez pour voir le live
          </p>
        </div>
      )}
    </div>,
    document.body
  );
}

export function LivePipPreviewFloat({
  live,
  onJoin,
  onClose,
}: {
  live: Live;
  onJoin: () => void;
  onClose: () => void;
}) {
  return <LivePipPreviewFloatInner live={live} onJoin={onJoin} onClose={onClose} />;
}
