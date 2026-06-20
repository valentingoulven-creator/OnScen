/** Floating PiP preview — shows the YouTube video for a salon without joining it. */

import { createPortal } from 'react-dom';
import { computePlaybackPositionMs, buildYouTubeEmbedUrl, isValidYoutubeVideoId } from '../lib/salonPlayback';
import { useDraggableVideoPip, VIDEO_PIP_WIDTH, VIDEO_PIP_HEADER_HEIGHT } from './DraggableVideoPip';
import type { Salon } from '../types';

function SalonPipPreviewFloatInner({
  salon,
  trackId,
  onJoin,
  onClose,
}: {
  salon: Salon;
  trackId: string;
  onJoin: () => void;
  onClose: () => void;
}) {
  const pip = useDraggableVideoPip(true, onJoin);
  const positionSec = computePlaybackPositionMs(salon.playbackState) / 1000;
  const videoH = Math.round((VIDEO_PIP_WIDTH * 9) / 16);
  const src = buildYouTubeEmbedUrl(trackId, positionSec, true);

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
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onJoin}
          className="shrink-0 px-2 py-0.5 rounded text-[9px] text-purple-200 hover:bg-purple-600/30 transition"
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
      <iframe
        src={src}
        allow="autoplay; encrypted-media"
        style={{ width: VIDEO_PIP_WIDTH, height: videoH, border: 'none', display: 'block' }}
        title={salon.title}
      />
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
  if (salon.platform !== 'youtube') return null;
  const trackId = salon.playbackState.trackId;
  if (!isValidYoutubeVideoId(trackId)) return null;
  return (
    <SalonPipPreviewFloatInner
      salon={salon}
      trackId={trackId}
      onJoin={onJoin}
      onClose={onClose}
    />
  );
}
