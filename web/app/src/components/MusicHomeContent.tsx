import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { FeedTrendingUsersSection } from './FeedTrendingUsersSection';
import { useAuth } from '../context/AuthContext';
import { useMusicPlayer, type PlayerTrack } from '../context/MusicPlayerContext';
import { useEventsCountry } from '../hooks/useEventsCountry';
import { useTrendingUsers } from '../hooks/useTrendingUsers';
import { api } from '../lib/api';
import { dicebearAdventurerAvatar } from '../lib/avatarUrl';
import { formatCompactCount } from '../lib/formatCount';
import { formatDurationSec } from '../lib/compositionUpload';
import { HorizontalScrollCarousel } from './HorizontalScrollCarousel';
import type {
  MusicAlbumItem,
  MusicHomePayload,
  MusicHomeSection,
  MusicHomeWeeklySection,
  MusicSearchPayload,
  MusicTrackItem,
  MusicWeeklyReelItem,
} from '../lib/musicTypes';
import { partitionLibraryAlbums } from '../lib/musicAlbumKind';

export type MusicAlbumShelfMode = 'library' | 'discography';

/* ─────────────────────────────────────────────────────────────────────
 * Icônes inline (pas de dépendance externe)
 * ──────────────────────────────────────────────────────────────────── */

function PlayGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.29-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14Z" />
    </svg>
  );
}

function HeartGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 21s-6.716-4.297-9.428-8.03C.86 10.42 1.36 7.3 3.76 5.86c1.98-1.19 4.42-.6 5.74 1.02L12 9.6l2.5-2.72c1.32-1.62 3.76-2.21 5.74-1.02 2.4 1.44 2.9 4.56 1.19 7.11C18.716 16.703 12 21 12 21Z" />
    </svg>
  );
}

function PauseGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M7 5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1H7Zm8 0a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2Z" />
    </svg>
  );
}

/** Upvote discographie (▲) — même UX que le profil. */
function MusicTrackUpvoteButton({
  track,
  upvoteStatBasis = 'lifetime',
}: {
  track: MusicTrackItem;
  upvoteStatBasis?: 'lifetime' | 'weekly';
}) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [count, setCount] = useState(track.upvoteCount ?? 0);
  const [hasUpvoted, setHasUpvoted] = useState(Boolean(track.userHasUpvoted));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCount(track.upvoteCount ?? 0);
    setHasUpvoted(Boolean(track.userHasUpvoted));
  }, [track.id, track.upvoteCount, track.userHasUpvoted]);

  const label = hasUpvoted
    ? t('music.upvoteRemove', { defaultValue: 'Retirer votre vote' })
    : t('music.upvoteAdd', { defaultValue: 'Voter pour ce morceau' });

  if (!token) {
    return (
      <span
        className="shrink-0 flex flex-col items-center justify-center min-w-[2rem] px-1 py-0.5 text-gray-500 tabular-nums"
        aria-label={t('music.upvoteCount', { defaultValue: '{{count}} votes', count })}
      >
        <span className="text-[10px] leading-none" aria-hidden>
          ▲
        </span>
        <span className="text-[10px] font-bold leading-tight">{formatCompactCount(count)}</span>
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={(e) => {
        e.stopPropagation();
        if (busy) return;
        setBusy(true);
        void api
          .toggleCompositionUpvote(token, track.id)
          .then((result) => {
            setHasUpvoted(result.userHasUpvoted);
            if (upvoteStatBasis === 'weekly') {
              setCount((c) => Math.max(0, c + (result.userHasUpvoted ? 1 : -1)));
            } else {
              setCount(result.upvoteCount);
            }
          })
          .finally(() => setBusy(false));
      }}
      className={`shrink-0 flex flex-col items-center justify-center min-w-[2.75rem] min-h-[44px] px-1.5 py-1 rounded-lg border transition disabled:opacity-50 touch-manipulation ${
        hasUpvoted
          ? 'border-amber-400/50 bg-amber-500/15 text-amber-300'
          : 'border-amber-500/20 text-gray-500 hover:border-amber-400/40 hover:text-amber-300 hover:bg-amber-500/10'
      }`}
      aria-pressed={hasUpvoted}
      aria-label={label}
      title={label}
    >
      <span className="text-[10px] leading-none" aria-hidden>
        ▲
      </span>
      <span className="text-[10px] font-bold leading-tight tabular-nums">{formatCompactCount(count)}</span>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 * Lecture — conversion morceau Music Home → lecteur global
 * ──────────────────────────────────────────────────────────────────── */

function trackToPlayerTrack(track: MusicTrackItem): PlayerTrack {
  return {
    id: track.id,
    title: track.title,
    artist: track.artist,
    ...(track.albumArtUrl ? { albumArtUrl: track.albumArtUrl } : {}),
    fileUrl: track.fileUrl,
    hostId: track.hostId,
    ...(track.albumId ? { albumId: track.albumId } : {}),
  };
}

/** Récupère les morceaux d'un album (API publique) pour alimenter la file de lecture. */
async function fetchAlbumPlayerTracks(
  token: string,
  album: { id: string; userId: string; trackCount: number; coverUrl?: string; creatorName: string }
): Promise<PlayerTrack[]> {
  if (album.trackCount <= 0) return [];
  const { tracks } = await api.getAlbumTracks(token, album.userId, album.id);
  return tracks.map((tr) => ({
    id: tr.id,
    title: tr.title,
    artist: tr.artist?.trim() || album.creatorName,
    ...(album.coverUrl ? { albumArtUrl: album.coverUrl } : {}),
    fileUrl: tr.fileUrl,
    hostId: tr.userId,
    ...(tr.albumId ? { albumId: tr.albumId } : {}),
  }));
}

/* ─────────────────────────────────────────────────────────────────────
 * Covers / artwork
 * ──────────────────────────────────────────────────────────────────── */

function MusicCover({
  url,
  title,
  size = 'md',
}: {
  url?: string;
  title: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClass =
    size === 'sm' ? 'size-10' : size === 'lg' ? 'size-[4.5rem]' : 'size-12';
  if (url) {
    return (
      <img
        src={url}
        alt=""
        loading="lazy"
        decoding="async"
        className={`${sizeClass} shrink-0 rounded-lg object-cover bg-[#1a1a26]`}
      />
    );
  }
  return (
    <div
      className={`${sizeClass} shrink-0 rounded-lg bg-gradient-to-br from-purple-900/40 to-[#1a1a26] flex items-center justify-center text-[10px] font-bold text-purple-200/80`}
      aria-hidden
    >
      {title.slice(0, 1).toUpperCase()}
    </div>
  );
}

/** Pastille « play/pause » — lance la lecture du morceau/album au tap. */
function PlayBadge({ size = 'md', playing = false }: { size?: 'sm' | 'md'; playing?: boolean }) {
  const box = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';
  const icon = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  return (
    <span
      className={`${box} flex items-center justify-center rounded-full bg-gradient-to-br from-pink-600 to-purple-600 text-white shadow-lg shadow-purple-950/50`}
      aria-hidden
    >
      {playing ? <PauseGlyph className={icon} /> : <PlayGlyph className={`${icon} translate-x-[1px]`} />}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 * Track row (avec rang optionnel façon charts)
 * ──────────────────────────────────────────────────────────────────── */

export function MusicTrackRow({
  track,
  queue,
  onOpenProfile,
  rank,
  statKind = 'likes',
  upvoteStatBasis = 'lifetime',
}: {
  track: MusicTrackItem;
  /** Morceaux de la même rangée — lecture continue via suivant/précédent. */
  queue?: MusicTrackItem[];
  onOpenProfile?: (userId: string) => void;
  rank?: number;
  /** Affiche écoutes (Populaire) en plus des upvotes. */
  statKind?: 'likes' | 'plays';
  /** Tendance hebdo : compteur = upvotes de la semaine ; sinon total. */
  upvoteStatBasis?: 'lifetime' | 'weekly';
}) {
  const { t } = useTranslation();
  const player = useMusicPlayer();
  const isCurrent = player.currentTrack?.id === track.id;
  const isPlayingThis = isCurrent && player.isPlaying;

  const subtitle = [
    track.creatorName,
    track.albumTitle,
    track.durationSec ? formatDurationSec(track.durationSec) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const handleClick = () => {
    if (!track.fileUrl) {
      onOpenProfile?.(track.hostId);
      return;
    }
    const list = queue && queue.length > 0 ? queue.map(trackToPlayerTrack) : undefined;
    player.playTrack(trackToPlayerTrack(track), list);
  };

  return (
    <div
      className={`group w-full flex items-center gap-1 min-h-[56px] py-2 pr-1 rounded-lg hover:bg-white/[0.04] active:bg-white/[0.06] transition-colors ${
        isCurrent ? 'bg-purple-500/[0.06]' : ''
      }`}
    >
      <button
        type="button"
        onClick={handleClick}
        aria-label={
          isPlayingThis
            ? t('music.playerPauseTrack', { defaultValue: 'Mettre en pause {{title}}', title: track.title })
            : t('music.playerPlayTrack', { defaultValue: 'Lire {{title}}', title: track.title })
        }
        className="flex flex-1 min-w-0 items-center gap-3 text-left touch-manipulation"
      >
        {rank != null ? (
          <span
            className={`w-6 shrink-0 text-center text-sm font-black tabular-nums ${
              isCurrent ? 'text-purple-300' : 'text-gray-500 group-hover:text-purple-300'
            }`}
            aria-hidden
          >
            {rank}
          </span>
        ) : null}
        <div className="relative shrink-0">
          <MusicCover url={track.albumArtUrl} title={track.title} />
          <span
            className={`absolute inset-0 flex items-center justify-center rounded-lg bg-black/45 transition-opacity ${
              isPlayingThis ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
          >
            {isPlayingThis ? (
              <PauseGlyph className="w-5 h-5 text-white" />
            ) : (
              <PlayGlyph className="w-5 h-5 text-white" />
            )}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold truncate ${isCurrent ? 'text-purple-300' : 'text-gray-100'}`}>
            {track.title}
          </p>
          <p className="text-xs text-gray-500 truncate">{subtitle}</p>
        </div>
        {statKind === 'plays' && track.weeklyPlayCount != null && track.weeklyPlayCount > 0 ? (
          <span className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-gray-400 tabular-nums mr-0.5">
            <PlayGlyph className="w-3 h-3 text-amber-400/90" />
            {formatCompactCount(track.weeklyPlayCount)}
          </span>
        ) : null}
      </button>
      <MusicTrackUpvoteButton track={track} upvoteStatBasis={upvoteStatBasis} />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 * Reel card (poster vertical 9:16, carrousel)
 * ──────────────────────────────────────────────────────────────────── */

function MusicReelCard({
  reel,
  onOpenProfile,
}: {
  reel: MusicWeeklyReelItem;
  onOpenProfile?: (userId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpenProfile?.(reel.authorId)}
      className="group shrink-0 w-[8.5rem] sm:w-[9.5rem] flex flex-col text-left"
    >
      <div className="relative aspect-[9/16] w-full rounded-xl overflow-hidden bg-[#1a1a26] ring-1 ring-[#2a2a3a]">
        {reel.posterUrl ? (
          <img
            src={reel.posterUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-violet-900/40 to-[#0b0b0f] flex items-center justify-center text-2xl font-black text-violet-200/70">
            {reel.title.slice(0, 1).toUpperCase()}
          </div>
        )}
        <span className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 to-transparent" aria-hidden />
        <span className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <PlayBadge size="sm" />
        </span>
        {reel.weeklyUpvoteCount > 0 ? (
          <span className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-black/70 text-white tabular-nums">
            <HeartGlyph className="w-2.5 h-2.5 text-rose-400" />
            {formatCompactCount(reel.weeklyUpvoteCount)}
          </span>
        ) : null}
        <div className="absolute inset-x-2 bottom-2">
          <p className="text-xs font-semibold text-white truncate drop-shadow">{reel.title}</p>
          <p className="text-[10px] text-white/70 truncate">{reel.creatorName}</p>
        </div>
      </div>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 * Album card (artwork + play overlay)
 * ──────────────────────────────────────────────────────────────────── */

function MusicAlbumCard({
  album,
  onOpenProfile,
}: {
  album: MusicAlbumItem;
  onOpenProfile: (userId: string) => void;
}) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const player = useMusicPlayer();
  const [loadingPlay, setLoadingPlay] = useState(false);
  const avatar =
    album.creatorAvatarUrl ?? dicebearAdventurerAvatar(album.creatorName);
  const isCurrentAlbum = player.currentTrack?.albumId === album.id;
  const isPlayingThisAlbum = isCurrentAlbum && player.isPlaying;

  const handlePlay = async (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (isCurrentAlbum) {
      player.togglePlay();
      return;
    }
    if (!token || album.trackCount <= 0) {
      onOpenProfile(album.userId);
      return;
    }
    setLoadingPlay(true);
    try {
      const playerTracks = await fetchAlbumPlayerTracks(token, album);
      if (playerTracks.length === 0) {
        onOpenProfile(album.userId);
        return;
      }
      player.playTrack(playerTracks[0], playerTracks);
    } catch {
      onOpenProfile(album.userId);
    } finally {
      setLoadingPlay(false);
    }
  };

  return (
    <div className="group shrink-0 w-[9.5rem] sm:w-[10.5rem] flex flex-col text-left">
      <button
        type="button"
        onClick={handlePlay}
        disabled={loadingPlay}
        aria-label={
          isPlayingThisAlbum
            ? t('music.playerPauseAlbum', { defaultValue: 'Mettre en pause {{title}}', title: album.title })
            : t('music.playerPlayAlbum', { defaultValue: 'Lire {{title}}', title: album.title })
        }
        className="relative block w-full aspect-square rounded-xl overflow-hidden bg-[#1a1a26] ring-1 ring-[#2a2a3a] group-hover:ring-purple-500/40 transition disabled:opacity-80 touch-manipulation"
      >
        {album.coverUrl ? (
          <img
            src={album.coverUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/35 via-[#1a1a26] to-[#0b0b0f] flex items-center justify-center">
            <span className="text-2xl font-black text-purple-200/70" aria-hidden>
              {album.title.slice(0, 1).toUpperCase()}
            </span>
          </div>
        )}
        <span
          className={`absolute bottom-1.5 right-1.5 transition-all duration-200 ${
            isPlayingThisAlbum
              ? 'translate-y-0 opacity-100'
              : 'translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100'
          }`}
        >
          <PlayBadge playing={isPlayingThisAlbum} />
        </span>
        <span className="absolute top-1.5 left-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-black/70 text-white tabular-nums">
          {t('music.trackCount', {
            defaultValue: '{{count}} morceau(x)',
            count: album.trackCount,
          })}
        </span>
      </button>
      <p className="mt-2 text-sm font-semibold text-gray-100 truncate">{album.title}</p>
      <button
        type="button"
        onClick={() => onOpenProfile(album.userId)}
        className="flex items-center gap-1.5 mt-0.5 min-w-0 text-left touch-manipulation"
      >
        <img src={avatar} alt="" className="size-4 rounded-full shrink-0 object-cover bg-[#1a1a26]" />
        <p className="text-[11px] text-gray-500 truncate hover:text-gray-300">{album.creatorName}</p>
      </button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 * Créateur (avatar circulaire, carrousel « à suivre »)
 * ──────────────────────────────────────────────────────────────────── */

interface MusicCreator {
  userId: string;
  name: string;
  avatarUrl?: string;
}

function MusicCreatorCard({
  creator,
  onOpenProfile,
}: {
  creator: MusicCreator;
  onOpenProfile: (userId: string) => void;
}) {
  const avatar = creator.avatarUrl ?? dicebearAdventurerAvatar(creator.name);
  return (
    <button
      type="button"
      onClick={() => onOpenProfile(creator.userId)}
      className="group shrink-0 w-[5.5rem] flex flex-col items-center text-center"
    >
      <img
        src={avatar}
        alt=""
        loading="lazy"
        decoding="async"
        className="size-[4.5rem] rounded-full object-cover bg-[#1a1a26] ring-1 ring-[#2a2a3a] group-hover:ring-purple-500/50 transition"
      />
      <p className="mt-1.5 w-full text-[11px] font-medium text-gray-300 truncate">{creator.name}</p>
    </button>
  );
}

function collectCreators(sections: (MusicHomeSection | undefined)[]): MusicCreator[] {
  const map = new Map<string, MusicCreator>();
  for (const section of sections) {
    if (!section) continue;
    for (const album of section.albums) {
      if (!map.has(album.userId)) {
        map.set(album.userId, {
          userId: album.userId,
          name: album.creatorName,
          avatarUrl: album.creatorAvatarUrl,
        });
      }
    }
    for (const track of section.tracks) {
      if (track.hostId && !map.has(track.hostId)) {
        map.set(track.hostId, { userId: track.hostId, name: track.creatorName });
      }
    }
  }
  return Array.from(map.values()).slice(0, 15);
}

/* ─────────────────────────────────────────────────────────────────────
 * Blocs communs
 * ──────────────────────────────────────────────────────────────────── */

function SectionEmpty({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[#2a2a3a] bg-[#12121a]/60 px-4 py-6 text-center">
      <p className="text-[11px] text-gray-500 leading-snug">{message}</p>
    </div>
  );
}

function SectionHeader({
  id,
  title,
  subtitle,
  action,
}: {
  id: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-2 mb-3">
      <div className="min-w-0">
        <h2 id={id} className="text-lg sm:text-xl font-bold text-white tracking-tight truncate">
          {title}
        </h2>
        {subtitle ? (
          <p className="text-xs text-gray-400 mt-1 leading-snug">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

/** En-tête de rangée façon Spotify (titre + « Tout afficher »). */
function SpotifyShelfHeader({
  id,
  title,
  onShowAll,
  showAllLabel,
}: {
  id: string;
  title: string;
  onShowAll?: () => void;
  showAllLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <h2 id={id} className="text-lg sm:text-xl font-bold text-white tracking-tight truncate min-w-0">
        {title}
      </h2>
      {onShowAll ? (
        <button
          type="button"
          onClick={onShowAll}
          className="shrink-0 min-h-11 px-2 text-xs font-bold text-gray-400 hover:text-white transition-colors"
        >
          {showAllLabel}
        </button>
      ) : null}
    </div>
  );
}

function ShelfLabel({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-[10px] font-semibold text-gray-500 mb-2 uppercase tracking-wide">
      {children}
    </h3>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 * Contenu d'une section (reels / albums / morceaux)
 * ──────────────────────────────────────────────────────────────────── */

const NEWS_SECTIONS = ['weeklyTrend', 'discover', 'popular'] as const;
type NewsSection = (typeof NEWS_SECTIONS)[number];

const FOR_YOU_SECTIONS = ['following', 'library'] as const;
type ForYouSection = (typeof FOR_YOU_SECTIONS)[number];

type HomeSectionKey = NewsSection | ForYouSection;
type MusicHomeTab = 'news' | 'forYou';

const SHELF_PREVIEW_LIMITS = { albums: 10, tracks: 5, reels: 8 } as const;

function sliceSectionForPreview(
  section: MusicHomeSection | MusicHomeWeeklySection,
  limits = SHELF_PREVIEW_LIMITS
): {
  preview: MusicHomeSection | MusicHomeWeeklySection;
  hasMore: boolean;
} {
  const reels = 'reels' in section ? section.reels : [];
  const previewAlbums = section.albums.slice(0, limits.albums);
  const previewTracks = section.tracks.slice(0, limits.tracks);
  const previewReels = reels.slice(0, limits.reels);
  const hasMore =
    section.albums.length > limits.albums ||
    section.tracks.length > limits.tracks ||
    reels.length > limits.reels;

  if ('reels' in section) {
    return {
      preview: {
        ...section,
        albums: previewAlbums,
        tracks: previewTracks,
        reels: previewReels,
      },
      hasMore,
    };
  }
  return {
    preview: { ...section, albums: previewAlbums, tracks: previewTracks },
    hasMore,
  };
}

function sectionHasContent(section: MusicHomeSection | MusicHomeWeeklySection): boolean {
  const reelCount = 'reels' in section ? section.reels.length : 0;
  return section.albums.length + section.tracks.length + reelCount > 0;
}

function AlbumCarousel({
  albums,
  label,
  onOpenProfile,
}: {
  albums: MusicAlbumItem[];
  label: string;
  onOpenProfile: (userId: string) => void;
}) {
  const { t } = useTranslation();
  if (albums.length === 0) return null;
  return (
    <div>
      <ShelfLabel>{label}</ShelfLabel>
      <HorizontalScrollCarousel
        itemCount={albums.length}
        ariaPrevLabel={t('music.scrollPrev', { defaultValue: 'Précédent' })}
        ariaNextLabel={t('music.scrollNext', { defaultValue: 'Suivant' })}
      >
        {albums.map((album) => (
          <MusicAlbumCard key={album.id} album={album} onOpenProfile={onOpenProfile} />
        ))}
      </HorizontalScrollCarousel>
    </div>
  );
}

function MusicSectionContent({
  section,
  emptyMessage,
  onOpenProfile,
  rankedTracks = false,
  trackStatKind = 'likes',
  upvoteStatBasis = 'lifetime',
  albumShelfMode = 'discography',
  viewerUserId,
}: {
  section: MusicHomeSection | MusicHomeWeeklySection;
  emptyMessage: string;
  onOpenProfile: (userId: string) => void;
  rankedTracks?: boolean;
  trackStatKind?: 'likes' | 'plays';
  upvoteStatBasis?: 'lifetime' | 'weekly';
  /** library = playlists + mes albums ; discography = albums créateurs (pas de libellé « playlists »). */
  albumShelfMode?: MusicAlbumShelfMode;
  viewerUserId?: string | null;
}) {
  const { t } = useTranslation();
  const reels = 'reels' in section ? section.reels : [];

  const { playlists, discographyAlbums } = useMemo(() => {
    if (albumShelfMode === 'library') {
      return partitionLibraryAlbums(section.albums, viewerUserId);
    }
    return { playlists: [] as MusicAlbumItem[], discographyAlbums: section.albums };
  }, [albumShelfMode, section.albums, viewerUserId]);

  if (!sectionHasContent(section)) {
    return <SectionEmpty message={emptyMessage} />;
  }

  return (
    <div className="space-y-5">
      {reels.length > 0 ? (
        <div>
          <ShelfLabel>{t('music.reelsLabel', { defaultValue: 'Reels' })}</ShelfLabel>
          <HorizontalScrollCarousel
            itemCount={reels.length}
            ariaPrevLabel={t('music.scrollPrev', { defaultValue: 'Précédent' })}
            ariaNextLabel={t('music.scrollNext', { defaultValue: 'Suivant' })}
          >
            {reels.map((reel) => (
              <MusicReelCard key={reel.id} reel={reel} onOpenProfile={onOpenProfile} />
            ))}
          </HorizontalScrollCarousel>
        </div>
      ) : null}

      {albumShelfMode === 'library' ? (
        <>
          <AlbumCarousel
            albums={playlists}
            label={t('music.playlistsOnlyLabel', { defaultValue: 'Playlists' })}
            onOpenProfile={onOpenProfile}
          />
          <AlbumCarousel
            albums={discographyAlbums}
            label={t('music.albumsLabel', { defaultValue: 'Albums' })}
            onOpenProfile={onOpenProfile}
          />
        </>
      ) : section.albums.length > 0 ? (
        <AlbumCarousel
          albums={section.albums}
          label={t('music.albumsLabel', { defaultValue: 'Albums' })}
          onOpenProfile={onOpenProfile}
        />
      ) : null}

      {section.tracks.length > 0 ? (
        <div>
          <ShelfLabel>{t('music.tracksLabel', { defaultValue: 'Morceaux' })}</ShelfLabel>
          <div className="rounded-xl border border-[#1e1e2f] bg-[#12121a]/80 px-2 divide-y divide-[#1e1e2f]/70">
            {section.tracks.map((track, i) => (
              <MusicTrackRow
                key={track.id}
                track={track}
                queue={section.tracks}
                onOpenProfile={onOpenProfile}
                rank={rankedTracks ? i + 1 : undefined}
                statKind={trackStatKind}
                upvoteStatBasis={upvoteStatBasis}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 * Home
 * ──────────────────────────────────────────────────────────────────── */

export function MusicHomeSections({
  data,
  loading,
  onOpenProfile,
  isActive = true,
}: {
  data: MusicHomePayload | null;
  loading: boolean;
  onOpenProfile: (userId: string) => void;
  isActive?: boolean;
}) {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = useState<MusicHomeTab>('news');
  const [expandedCategory, setExpandedCategory] = useState<HomeSectionKey | null>(null);
  const { countryCode, countryName } = useEventsCountry({
    enabled: isActive,
    profileCity: user?.city,
  });
  const { users: trendingUsers, loading: trendingLoading } = useTrendingUsers({
    enabled: isActive,
    token,
    countryCode,
  });

  const tabs = useMemo(
    () =>
      [
        ['news', t('music.tabNews', { defaultValue: 'Actualité' })],
        ['forYou', t('music.tabForYou', { defaultValue: 'Pour toi' })],
      ] as const,
    [t],
  );

  const creators = useMemo(
    () =>
      data
        ? collectCreators([data.weeklyTrend, data.discover, data.popular])
        : [],
    [data],
  );

  const sectionLabels: Record<HomeSectionKey, string> = {
    weeklyTrend: t('music.tabWeeklyTrend', { defaultValue: 'Tendance de la semaine' }),
    discover: t('music.tabDiscover', { defaultValue: 'Découvrir' }),
    popular: t('music.tabPopular', { defaultValue: 'Populaire' }),
    following: t('music.followingSoundTitle', {
      defaultValue: 'Nouveaux sons',
    }),
    library: t('music.myPlaylistsTitle', { defaultValue: 'Mes playlists' }),
  };

  const emptyBySection: Record<HomeSectionKey, string> = {
    weeklyTrend: t('music.emptyWeeklyTrend', {
      defaultValue:
        'Aucun upvote sur la discographie ni reel cette semaine. Le classement se réinitialise chaque lundi.',
    }),
    discover: t('music.emptyDiscover', {
      defaultValue:
        'Aucun morceau ni playlist sur les profils pour le moment. Publie ta discographie depuis ton profil.',
    }),
    following: t('music.emptyFollowing', {
      defaultValue: 'Suis des créateurs pour voir leurs albums et morceaux ici.',
    }),
    library: t('music.emptyLibrary', {
      defaultValue: 'Ajoute des morceaux ou crée une playlist depuis l’onglet Discographie de ton profil.',
    }),
    popular: t('music.emptyPopular', {
      defaultValue:
        'Les morceaux les plus écoutés cette semaine apparaîtront ici. Écoute une discographie pour alimenter le classement.',
    }),
  };

  if (loading && !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-32 rounded-2xl bg-[#12121a] ms-skeleton" />
        <div className="flex gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-36 w-36 rounded-xl bg-[#12121a] ms-skeleton" />
          ))}
        </div>
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-[#12121a] ms-skeleton" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const showAllLabel = t('music.showAll', { defaultValue: 'Tout afficher' });

  const categorySubtitles: Partial<Record<HomeSectionKey, string>> = {
    weeklyTrend: t('music.weeklyTrendSubtitle', {
      defaultValue:
        'Albums, morceaux et reels les plus upvotés cette semaine · reset lundi',
    }),
    popular: t('music.popularSubtitle', {
      defaultValue: 'Les morceaux les plus écoutés cette semaine · reset lundi',
    }),
  };

  const resolveSection = (sectionId: HomeSectionKey): MusicHomeSection | MusicHomeWeeklySection => {
    if (sectionId === 'weeklyTrend') return data.weeklyTrend;
    return data[sectionId];
  };

  const renderCategoryShelf = (sectionId: HomeSectionKey) => {
    const section = resolveSection(sectionId);
    if (!sectionHasContent(section)) {
      return (
        <section key={sectionId} aria-labelledby={`music-shelf-${sectionId}`} className="mb-8">
          <SpotifyShelfHeader id={`music-shelf-${sectionId}`} title={sectionLabels[sectionId]} showAllLabel={showAllLabel} />
          <SectionEmpty message={emptyBySection[sectionId]} />
        </section>
      );
    }
    const { preview } = sliceSectionForPreview(section);
    return (
      <section key={sectionId} aria-labelledby={`music-shelf-${sectionId}`} className="mb-8">
        <SpotifyShelfHeader
          id={`music-shelf-${sectionId}`}
          title={sectionLabels[sectionId]}
          showAllLabel={showAllLabel}
          onShowAll={() => setExpandedCategory(sectionId)}
        />
        {categorySubtitles[sectionId] ? (
          <p className="text-xs text-gray-500 -mt-2 mb-3">{categorySubtitles[sectionId]}</p>
        ) : null}
        <MusicSectionContent
          section={preview}
          emptyMessage={emptyBySection[sectionId]}
          onOpenProfile={onOpenProfile}
          rankedTracks={sectionId === 'popular' || sectionId === 'weeklyTrend'}
          trackStatKind={sectionId === 'popular' ? 'plays' : 'likes'}
          upvoteStatBasis={sectionId === 'weeklyTrend' ? 'weekly' : 'lifetime'}
          albumShelfMode={sectionId === 'library' ? 'library' : 'discography'}
          viewerUserId={user?.id}
        />
      </section>
    );
  };

  return (
    <div className="space-y-5">
      <div
        className="flex gap-1 border-b border-white/10 pb-0"
        role="tablist"
        aria-label={t('music.feedTabs', { defaultValue: 'Sections musique' })}
      >
        {tabs.map(([id, label]) => {
          const selected = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => {
                setActiveTab(id);
                setExpandedCategory(null);
              }}
              className={`relative flex-1 min-h-11 px-2 py-2.5 text-sm font-bold transition touch-manipulation ${
                selected ? 'text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {label}
              {selected ? (
                <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-gradient-to-r from-pink-500 to-purple-500" aria-hidden />
              ) : null}
            </button>
          );
        })}
      </div>

      {expandedCategory ? (
        <section aria-labelledby={`music-expanded-${expandedCategory}`}>
          <button
            type="button"
            onClick={() => setExpandedCategory(null)}
            className="mb-4 min-h-11 inline-flex items-center gap-2 text-sm font-semibold text-gray-300 hover:text-white"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
            </svg>
            {t('music.backToHome', { defaultValue: 'Accueil musique' })}
          </button>
          <SectionHeader
            id={`music-expanded-${expandedCategory}`}
            title={sectionLabels[expandedCategory]}
            subtitle={categorySubtitles[expandedCategory]}
          />
          <MusicSectionContent
            section={resolveSection(expandedCategory)}
            emptyMessage={emptyBySection[expandedCategory]}
            onOpenProfile={onOpenProfile}
            rankedTracks={expandedCategory === 'popular' || expandedCategory === 'weeklyTrend'}
            trackStatKind={expandedCategory === 'popular' ? 'plays' : 'likes'}
            upvoteStatBasis={expandedCategory === 'weeklyTrend' ? 'weekly' : 'lifetime'}
            albumShelfMode={expandedCategory === 'library' ? 'library' : 'discography'}
            viewerUserId={user?.id}
          />
        </section>
      ) : activeTab === 'news' ? (
        <div className="space-y-6 pb-2">
          {creators.length > 0 ? (
            <section aria-labelledby="music-creators" className="mb-4">
              <SpotifyShelfHeader
                id="music-creators"
                title={t('music.creatorsTitle', { defaultValue: 'Créateurs à découvrir' })}
                showAllLabel={showAllLabel}
              />
              <HorizontalScrollCarousel
                itemCount={creators.length}
                ariaPrevLabel={t('music.scrollPrev', { defaultValue: 'Précédent' })}
                ariaNextLabel={t('music.scrollNext', { defaultValue: 'Suivant' })}
              >
                {creators.map((creator) => (
                  <MusicCreatorCard
                    key={creator.userId}
                    creator={creator}
                    onOpenProfile={onOpenProfile}
                  />
                ))}
              </HorizontalScrollCarousel>
            </section>
          ) : null}

          <section aria-labelledby="music-trending-artists">
            <SpotifyShelfHeader
              id="music-trending-artists"
              title={t('music.trendingArtistsTitle', {
                defaultValue: 'Artistes tendance',
              })}
              showAllLabel={showAllLabel}
            />
            <FeedTrendingUsersSection
              users={trendingUsers}
              loading={trendingLoading}
              countryCode={countryCode}
              countryName={countryName}
              onOpenProfile={onOpenProfile}
              hideHeader
            />
          </section>

          {NEWS_SECTIONS.map((sectionId) => renderCategoryShelf(sectionId))}
        </div>
      ) : (
        <div className="space-y-6 pb-2">
          {FOR_YOU_SECTIONS.map((sectionId) => renderCategoryShelf(sectionId))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 * Résultats de recherche
 * ──────────────────────────────────────────────────────────────────── */

export function MusicSearchResults({
  results,
  loading,
  query,
  onOpenProfile,
}: {
  results: MusicSearchPayload | null;
  loading: boolean;
  query: string;
  onOpenProfile: (userId: string) => void;
}) {
  const { t } = useTranslation();

  if (query.trim().length < 2) return null;

  if (loading && !results) {
    return (
      <div className="space-y-2 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 rounded-lg bg-[#12121a] ms-skeleton" />
        ))}
      </div>
    );
  }

  const albums = results?.albums ?? [];
  const tracks = results?.tracks ?? [];

  if (!loading && albums.length === 0 && tracks.length === 0) {
    return (
      <SectionEmpty
        message={t('music.searchEmpty', {
          defaultValue: 'Aucun album ni morceau utilisateur pour cette recherche.',
        })}
      />
    );
  }

  return (
    <section aria-labelledby="music-search-results" className="space-y-5">
      <SectionHeader
        id="music-search-results"
        title={t('music.searchResults', { defaultValue: 'Résultats' })}
        subtitle={t('music.searchResultsFor', {
          defaultValue: '« {{query}} »',
          query: query.trim(),
        })}
      />
      {albums.length > 0 ? (
        <AlbumCarousel
          albums={albums}
          label={t('music.albumsLabel', { defaultValue: 'Albums' })}
          onOpenProfile={onOpenProfile}
        />
      ) : null}
      {tracks.length > 0 ? (
        <div>
          <ShelfLabel>{t('music.tracksLabel', { defaultValue: 'Morceaux' })}</ShelfLabel>
          <div className="rounded-xl border border-[#1e1e2f] bg-[#12121a]/80 px-2 divide-y divide-[#1e1e2f]/70">
            {tracks.map((track) => (
              <MusicTrackRow
                key={track.id}
                track={track}
                queue={tracks}
                onOpenProfile={onOpenProfile}
                upvoteStatBasis="lifetime"
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
