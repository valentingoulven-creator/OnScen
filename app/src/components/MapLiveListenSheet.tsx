import type { RefObject } from 'react';
import { HostRatingBlock } from './HostRatingBlock';
import { OpenOnYoutubeButton } from './OpenOnYoutubeButton';
import { UserAvatarOnline } from './UserAvatarOnline';
import { UsernameDisplay } from './UsernameDisplay';
import { computePlaybackPositionMs } from '../lib/salonPlayback';
import type { Live } from '../types';

export const MAP_LIVE_OUTLINE_BUTTON_CLASS =
  'inline-flex items-center justify-center px-3 py-1.5 rounded-full text-sm font-medium border border-red-500/80 text-red-400 bg-transparent hover:bg-red-500/10 hover:text-red-300 hover:border-red-400 transition shrink-0';

interface MapLiveListenSheetProps {
  live: Live;
  sheetRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onOpenFullExperience: () => void;
  onOpenHostProfile?: () => void;
}

export function MapLiveListenSheet({
  live,
  sheetRef,
  onClose,
  onOpenFullExperience,
  onOpenHostProfile,
}: MapLiveListenSheetProps) {
  const playback = live.playbackState;
  const trackPlatform = playback.platform ?? live.platform;
  const viewersLabel = `${live.viewersCount} spectateur${live.viewersCount !== 1 ? 's' : ''}`;
  const showLiveTitle =
    live.title.trim().length > 0 &&
    live.title.trim().toLowerCase() !== playback.title.trim().toLowerCase();

  return (
    <div
      ref={sheetRef}
      className="absolute bottom-0 left-0 right-0 z-30 bg-[#0e0e14] border-t border-white/10 flex flex-col shadow-[0_-12px_40px_rgba(0,0,0,0.5)] max-h-[42dvh]"
    >
      <div className="shrink-0 px-3 py-3 border-b border-white/10">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex flex-1 min-w-0 items-start gap-3">
            <img
              src={playback.albumArtUrl}
              alt=""
              className="w-16 h-16 rounded-lg object-cover shrink-0 shadow-lg shadow-black/50 ring-1 ring-white/10 bg-[#1a1a26]"
              onError={(e) => {
                e.currentTarget.style.visibility = 'hidden';
              }}
            />
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="font-semibold text-white text-base leading-snug tracking-tight truncate">
                {playback.title}
              </p>
              {playback.artist ? (
                <p className="text-sm text-[#8b8baf] truncate mt-0.5">{playback.artist}</p>
              ) : null}
              <p className="text-[11px] text-[#6b6b8a] mt-0.5 flex items-center gap-2 min-w-0">
                <span className="truncate inline-flex items-center gap-1 min-w-0">
                  <UsernameDisplay
                    username={live.hostName}
                    usernameColor={live.hostUsernameColor}
                    usernameWaveFrom={live.hostUsernameWaveFrom}
                    usernameWaveTo={live.hostUsernameWaveTo}
                    className="truncate"
                  />
                  {showLiveTitle ? (
                    <span className="shrink-0 text-[#6b6b8a] truncate">· {live.title}</span>
                  ) : null}
                </span>
                <HostRatingBlock
                  hostId={live.hostId}
                  hostName={live.hostName}
                  inline
                  hideLabel
                  compact
                  mutedStars
                />
              </p>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className="text-[9px] font-semibold text-[#c47a7a] bg-[#1a1214] px-1.5 py-0.5 rounded-md border border-white/10">
                  LIVE
                </span>
                {trackPlatform === 'youtube' && playback.trackId ? (
                  <OpenOnYoutubeButton
                    trackId={playback.trackId}
                    positionMs={computePlaybackPositionMs(playback)}
                    variant="youtube-red"
                    label="YouTube"
                  />
                ) : (
                  <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-md border capitalize text-[#8b8baf] border-white/10 bg-[#131318]">
                    {trackPlatform}
                  </span>
                )}
                <span className="text-[10px] text-[#8b8baf] tabular-nums">{viewersLabel}</span>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-1 shrink-0 self-start pt-0.5">
            {onOpenHostProfile ? (
              <button
                type="button"
                onClick={onOpenHostProfile}
                className="shrink-0 rounded-full ring-2 ring-white/10 hover:ring-[#8b8baf]/35 transition active:scale-95"
                aria-label={`Profil de ${live.hostName}`}
              >
                <UserAvatarOnline
                  userId={live.hostId}
                  username={live.hostName}
                  size="xl"
                  isLive
                />
              </button>
            ) : null}
            <button
              type="button"
              onClick={onOpenFullExperience}
              className={MAP_LIVE_OUTLINE_BUTTON_CLASS}
              title="Ouvrir le live en plein écran"
            >
              Live
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#6b6b8a] hover:text-white hover:bg-white/10 transition shrink-0"
              aria-label="Fermer la fiche live"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
