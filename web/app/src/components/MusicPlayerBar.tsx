import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import { api } from '../lib/api';
import { FollowUserButton } from './FollowUserButton';
import { MusicTrackOptionsMenu } from './MusicTrackOptionsMenu';

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.29-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14Z" />
    </svg>
  );
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M7 5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1H7Zm8 0a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2Z" />
    </svg>
  );
}

function SkipIcon({ className, dir = 'next' }: { className?: string; dir?: 'next' | 'prev' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden
      style={dir === 'prev' ? { transform: 'scaleX(-1)' } : undefined}
    >
      <path d="M6 6a1 1 0 0 1 1.54-.84l9 6a1 1 0 0 1 0 1.68l-9 6A1 1 0 0 1 6 18V6Z" />
      <rect x="16" y="5" width="2" height="14" rx="1" />
    </svg>
  );
}

function MoreIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function VolumeIcon({ muted, level }: { muted: boolean; level: number }) {
  if (muted || level === 0) {
    return (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path strokeLinecap="round" d="M11 5L6 9H3v6h3l5 4V5Z" />
        <path strokeLinecap="round" d="m16 9 6 6M22 9l-6 6" />
      </svg>
    );
  }
  if (level < 50) {
    return (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path strokeLinecap="round" d="M11 5L6 9H3v6h3l5 4V5Z" />
        <path strokeLinecap="round" d="M15.5 8.5a5 5 0 0 1 0 7" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" d="M11 5L6 9H3v6h3l5 4V5Z" />
      <path strokeLinecap="round" d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path strokeLinecap="round" d="M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}

function MusicPlayerVolumeControl({
  volume,
  muted,
  onVolumeChange,
  onToggleMuted,
}: {
  volume: number;
  muted: boolean;
  onVolumeChange: (value: number) => void;
  onToggleMuted: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc, { passive: true });
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('touchstart', onDoc);
    };
  }, [open]);

  const slider = (
    <input
      type="range"
      min={0}
      max={100}
      value={muted ? 0 : volume}
      onChange={(e) => {
        const v = Number(e.target.value);
        onVolumeChange(v);
      }}
      className="w-full min-w-0 accent-purple-500 h-1 touch-manipulation"
      aria-label={t('music.playerVolume', { defaultValue: 'Volume' })}
    />
  );

  const muteLabel = muted
    ? t('music.playerUnmute', { defaultValue: 'Réactiver le son' })
    : t('music.playerMute', { defaultValue: 'Couper le son' });

  return (
    <>
      <div ref={rootRef} className="relative shrink-0 sm:hidden">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-11 h-11 flex items-center justify-center rounded-full text-gray-400 hover:text-white touch-manipulation"
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={t('music.playerVolume', { defaultValue: 'Volume' })}
        >
          <VolumeIcon muted={muted} level={volume} />
        </button>
        {open ? (
          <div
            role="dialog"
            aria-label={t('music.playerVolume', { defaultValue: 'Volume' })}
            className="absolute bottom-[calc(100%+0.5rem)] right-0 z-[80] w-[min(100vw-2rem,14rem)] rounded-xl border border-white/10 bg-[#14141c]/98 backdrop-blur-md shadow-xl p-3"
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onToggleMuted}
                className="shrink-0 w-11 h-11 flex items-center justify-center rounded-full border border-white/10 text-gray-400 hover:text-white touch-manipulation"
                aria-label={muteLabel}
              >
                <VolumeIcon muted={muted} level={volume} />
              </button>
              <div className="flex-1 min-w-0 pt-0.5">{slider}</div>
            </div>
          </div>
        ) : null}
      </div>
      <div className="hidden sm:flex items-center gap-1 shrink-0 w-[min(7rem,20vw)] max-w-32">
        <button
          type="button"
          onClick={onToggleMuted}
          className="w-10 h-10 flex items-center justify-center rounded-full text-gray-400 hover:text-white shrink-0 touch-manipulation"
          aria-label={muteLabel}
        >
          <VolumeIcon muted={muted} level={volume} />
        </button>
        {slider}
      </div>
    </>
  );
}

function MiniCover({ url, title }: { url?: string; title: string }) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        loading="lazy"
        decoding="async"
        className="size-[calc(2.75rem+0.15cm)] shrink-0 rounded-lg object-cover bg-[#1a1a26] ring-1 ring-white/15 ms-music-player-bar__cover"
      />
    );
  }
  return (
    <div
      className="size-[calc(2.75rem+0.15cm)] shrink-0 rounded-lg bg-gradient-to-br from-purple-900/40 to-[#1a1a26] flex items-center justify-center text-sm font-bold text-purple-200/80 ring-1 ring-white/15 ms-music-player-bar__cover"
      aria-hidden
    >
      {title.slice(0, 1).toUpperCase()}
    </div>
  );
}

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Bar de lecture persistante façon Spotify — affichée dès qu'un morceau est lancé.
 * Position `bottom: 0` + `padding-bottom: var(--tab-nav-total-h)` (index.css) :
 * fond jusqu’en bas, contrôles au-dessus du dock d’onglets.
 */
export function MusicPlayerBar({
  onOpenProfile,
}: {
  /** Ouvre le profil de l'artiste du morceau en cours au clic sur son nom. */
  onOpenProfile?: (userId: string) => void;
}) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const { audioRef, currentTrack, isPlaying, hasNext, hasPrev, playbackError, volume, muted, setVolume, toggleMuted, togglePlay, next, prev, seek, close, addToQueue } =
    useMusicPlayer();
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hostFollowing, setHostFollowing] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);

  useEffect(() => {
    if (!token || !currentTrack?.hostId) {
      setHostFollowing(false);
      return;
    }
    let cancelled = false;
    void api
      .getUserProfile(token, currentTrack.hostId)
      .then((res) => {
        if (!cancelled) setHostFollowing(Boolean(res.user.isFollowing));
      })
      .catch(() => {
        if (!cancelled) setHostFollowing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, currentTrack?.hostId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setPosition(audio.currentTime);
    const onLoaded = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('durationchange', onLoaded);
    setPosition(audio.currentTime);
    setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('durationchange', onLoaded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioRef, currentTrack?.id]);

  if (!currentTrack) return null;

  const progressPct = duration > 0 ? Math.min(100, Math.max(0, (position / duration) * 100)) : 0;

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    seek(ratio * duration);
  };

  return (
    <div
      className="fixed inset-x-0 ms-music-player-bar"
      role="region"
      aria-label={t('music.playerBarLabel', { defaultValue: 'Lecteur audio' })}
    >
      <div className="ms-music-player-bar__panel">
        <div className="ms-music-player-bar__panel-inner">
          <div
            className="ms-music-player-bar__progress cursor-pointer touch-manipulation"
            role="slider"
            tabIndex={0}
            aria-label={t('music.playerProgress', { defaultValue: 'Progression du morceau' })}
            aria-valuemin={0}
            aria-valuemax={Math.max(1, Math.round(duration))}
            aria-valuenow={Math.round(position)}
            onClick={handleSeek}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') seek(position + 5);
              if (e.key === 'ArrowLeft') seek(position - 5);
            }}
          >
            <div className="ms-music-player-bar__progress-fill" style={{ width: `${progressPct}%` }} />
          </div>

          <div className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 ms-music-player-bar__body">
        <MiniCover url={currentTrack.albumArtUrl} title={currentTrack.title} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-0.5 min-w-0 max-w-full overflow-hidden">
            <p className="text-sm font-semibold text-white truncate leading-tight min-w-0">
              {currentTrack.title}
            </p>
            <FollowUserButton
              userId={currentTrack.hostId}
              username={currentTrack.artist}
              initialFollowing={hostFollowing}
              iconOnly
              iconStyle="heart"
              pipHeader
              className="shrink-0"
              onFollowingChange={setHostFollowing}
            />
          </div>
          <p className="text-xs text-gray-400 truncate leading-tight">
            {onOpenProfile ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenProfile(currentTrack.hostId);
                }}
                className="hover:text-white hover:underline underline-offset-2 touch-manipulation"
              >
                {currentTrack.artist}
              </button>
            ) : (
              currentTrack.artist
            )}{' '}
            · {formatTime(position)} / {formatTime(duration)}
          </p>
          {playbackError ? (
            <p className="text-xs text-amber-400/95 truncate leading-tight mt-0.5" role="status">
              {playbackError}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          <button
            type="button"
            onClick={prev}
            disabled={!hasPrev}
            aria-label={t('music.playerPrev', { defaultValue: 'Morceau précédent' })}
            className="w-10 h-10 flex items-center justify-center rounded-full text-gray-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none touch-manipulation"
          >
            <SkipIcon dir="prev" className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={togglePlay}
            aria-label={
              isPlaying
                ? t('music.playerPause', { defaultValue: 'Mettre en pause' })
                : t('music.playerPlay', { defaultValue: 'Lecture' })
            }
            className="w-11 h-11 flex items-center justify-center rounded-full bg-gradient-to-br from-pink-600 to-purple-600 text-white shadow-lg shadow-purple-950/50 touch-manipulation"
          >
            {isPlaying ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5 translate-x-[1px]" />}
          </button>
          <button
            type="button"
            onClick={next}
            disabled={!hasNext}
            aria-label={t('music.playerNext', { defaultValue: 'Morceau suivant' })}
            className="w-10 h-10 flex items-center justify-center rounded-full text-gray-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none touch-manipulation"
          >
            <SkipIcon dir="next" className="w-4 h-4" />
          </button>
          <MusicPlayerVolumeControl
            volume={volume}
            muted={muted}
            onVolumeChange={setVolume}
            onToggleMuted={toggleMuted}
          />
          <button
            type="button"
            onClick={() => setOptionsOpen(true)}
            aria-label={t('music.playerMoreOptions', { defaultValue: "Plus d'options" })}
            className="w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:text-white touch-manipulation"
          >
            <MoreIcon className="w-4.5 h-4.5" />
          </button>
          <button
            type="button"
            onClick={close}
            aria-label={t('music.playerClose', { defaultValue: 'Fermer le lecteur' })}
            className="w-9 h-9 flex items-center justify-center rounded-full text-gray-500 hover:text-white touch-manipulation"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
          </div>
        </div>
      </div>

      {optionsOpen && (
        <MusicTrackOptionsMenu
          open={optionsOpen}
          onClose={() => setOptionsOpen(false)}
          track={currentTrack}
          token={token}
          onAddToQueue={addToQueue}
        />
      )}
    </div>
  );
}
