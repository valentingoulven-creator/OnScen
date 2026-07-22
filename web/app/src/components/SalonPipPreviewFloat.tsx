/** Floating PiP preview — shows the YouTube video for a salon without joining it. */

import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import {
  computePlaybackPositionMs,
  buildYouTubeEmbedUrl,
  resolveSalonYoutubeTrackId,
} from '../lib/salonPlayback';
import {
  useDraggableVideoPip,
  defaultVideoPipPos,
  VIDEO_PIP_WIDTH,
  VIDEO_PIP_HEADER_HEIGHT,
} from './DraggableVideoPip';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { FollowUserButton } from './FollowUserButton';
import type { Salon } from '../types';

function SalonPipPreviewFloatInner({
  salon,
  videoId,
  onJoin,
  onClose,
}: {
  salon: Salon;
  videoId: string | undefined;
  onJoin: () => void;
  onClose: () => void;
}) {
  const { token } = useAuth();
  const pip = useDraggableVideoPip(true, onJoin, defaultVideoPipPos);
  const videoH = Math.round((VIDEO_PIP_WIDTH * 9) / 16);
  const [hostFollowing, setHostFollowing] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void api.getMyFollowing(token).then((r) => {
      if (!cancelled) setHostFollowing(r.followingIds.includes(salon.hostId));
    });
    return () => {
      cancelled = true;
    };
  }, [token, salon.hostId]);
  const positionSec = videoId
    ? computePlaybackPositionMs(salon.playbackState) / 1000
    : 0;
  const src = videoId
    ? buildYouTubeEmbedUrl(videoId, positionSec, true, { controls: true, mute: false })
    : null;

  return createPortal(
    <div
      className="pointer-events-auto fixed rounded-xl overflow-hidden shadow-2xl border border-[#2a2a3a] bg-[#0b0b0f]"
      style={{ left: pip.position.x, top: pip.position.y, width: VIDEO_PIP_WIDTH, zIndex: 99999 }}
    >
      <div
        className="flex items-center gap-1.5 px-2 border-b border-[#2a2a36] bg-[#14141c]/95 cursor-grab active:cursor-grabbing select-none touch-none"
        style={{ height: VIDEO_PIP_HEADER_HEIGHT }}
        onPointerDown={pip.onHeaderPointerDown}
      >
        <span className="text-[10px] text-purple-400/80 leading-none shrink-0" aria-hidden>⠿</span>
        <p className="flex-1 truncate min-w-0 text-[9px] font-bold text-purple-400 uppercase tracking-widest">
          {salon.title}
        </p>
        <div
          className="shrink-0 inline-flex items-center self-center"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <FollowUserButton
            userId={salon.hostId}
            username={salon.hostName}
            initialFollowing={hostFollowing}
            relatedSalon={salon}
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
          title="Rejoindre le salon"
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
      {src ? (
        <iframe
          src={src}
          allow="autoplay; encrypted-media; picture-in-picture"
          style={{ width: VIDEO_PIP_WIDTH, height: videoH, border: 'none', display: 'block' }}
          title={salon.title}
        />
      ) : (
        <div
          className="flex items-center justify-center text-[11px] text-gray-500 bg-black"
          style={{ width: VIDEO_PIP_WIDTH, height: videoH }}
        >
          Chargement…
        </div>
      )}
    </div>,
    document.body
  );
}

export function SalonPipPreviewFloat({
  salon,
  onJoin,
  onClose,
}: {
  salon: Salon;
  onJoin: () => void;
  onClose: () => void;
}) {
  const { token } = useAuth();
  const [videoId, setVideoId] = useState<string | undefined>(
    () => resolveSalonYoutubeTrackId(salon.playbackState)
  );

  useEffect(() => {
    const id = resolveSalonYoutubeTrackId(salon.playbackState);
    if (id) {
      setVideoId(id);
      return;
    }
    if (!token) return;
    let cancelled = false;
    api.getSalon(token, salon.id).then(({ salon: fetched }) => {
      if (cancelled) return;
      const resolved = resolveSalonYoutubeTrackId(fetched.playbackState);
      if (resolved) setVideoId(resolved);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [salon.id, salon.playbackState, token]);

  return (
    <SalonPipPreviewFloatInner
      salon={salon}
      videoId={videoId}
      onJoin={onJoin}
      onClose={onClose}
    />
  );
}
