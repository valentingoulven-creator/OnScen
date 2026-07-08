import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
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
      className={`${sizeClass} shrink-0 rounded-lg bg-gradient-to-br from-amber-900/40 to-[#1a1a26] flex items-center justify-center text-[10px] font-bold text-amber-200/80`}
      aria-hidden
    >
      {title.slice(0, 1).toUpperCase()}
    </div>
  );
}

/** Pastille « play » décorative (affordance streaming ; le tap ouvre le profil). */
function PlayBadge({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';
  const icon = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  return (
    <span
      className={`${box} flex items-center justify-center rounded-full bg-amber-500 text-black shadow-lg shadow-black/40`}
      aria-hidden
    >
      <PlayGlyph className={`${icon} translate-x-[1px]`} />
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 * Track row (avec rang optionnel façon charts)
 * ──────────────────────────────────────────────────────────────────── */

export function MusicTrackRow({
  track,
  onOpenProfile,
  rank,
}: {
  track: MusicTrackItem;
  onOpenProfile?: (userId: string) => void;
  rank?: number;
}) {
  const subtitle = [
    track.creatorName,
    track.albumTitle,
    track.durationSec ? formatDurationSec(track.durationSec) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <button
      type="button"
      onClick={() => onOpenProfile?.(track.hostId)}
      className="group w-full flex items-center gap-3 min-h-[56px] py-2 pr-1 text-left rounded-lg hover:bg-white/[0.04] active:bg-white/[0.06] transition-colors"
    >
      {rank != null ? (
        <span
          className="w-6 shrink-0 text-center text-sm font-black tabular-nums text-gray-500 group-hover:text-amber-300"
          aria-hidden
        >
          {rank}
        </span>
      ) : null}
      <div className="relative shrink-0">
        <MusicCover url={track.albumArtUrl} title={track.title} />
        <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity">
          <PlayGlyph className="w-5 h-5 text-white" />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-100 truncate">{track.title}</p>
        <p className="text-xs text-gray-500 truncate">{subtitle}</p>
      </div>
      {track.upvoteCount != null && track.upvoteCount > 0 ? (
        <span className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-gray-400 tabular-nums">
          <HeartGlyph className="w-3 h-3 text-rose-400/80" />
          {formatCompactCount(track.upvoteCount)}
        </span>
      ) : null}
    </button>
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
  const avatar =
    album.creatorAvatarUrl ?? dicebearAdventurerAvatar(album.creatorName);

  return (
    <button
      type="button"
      onClick={() => onOpenProfile(album.userId)}
      className="group shrink-0 w-[9.5rem] sm:w-[10.5rem] flex flex-col text-left"
    >
      <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-[#1a1a26] ring-1 ring-[#2a2a3a] group-hover:ring-amber-500/40 transition">
        {album.coverUrl ? (
          <img
            src={album.coverUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-amber-900/35 via-[#1a1a26] to-[#0b0b0f] flex items-center justify-center">
            <span className="text-2xl font-black text-amber-200/70" aria-hidden>
              {album.title.slice(0, 1).toUpperCase()}
            </span>
          </div>
        )}
        <span
          className="absolute bottom-1.5 right-1.5 translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-200"
        >
          <PlayBadge />
        </span>
        <span className="absolute top-1.5 left-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-black/70 text-white tabular-nums">
          {t('music.trackCount', {
            defaultValue: '{{count}} morceau(x)',
            count: album.trackCount,
          })}
        </span>
      </div>
      <p className="mt-2 text-sm font-semibold text-gray-100 truncate">{album.title}</p>
      <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
        <img src={avatar} alt="" className="size-4 rounded-full shrink-0 object-cover bg-[#1a1a26]" />
        <p className="text-[11px] text-gray-500 truncate">{album.creatorName}</p>
      </div>
    </button>
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
        className="size-[4.5rem] rounded-full object-cover bg-[#1a1a26] ring-1 ring-[#2a2a3a] group-hover:ring-amber-500/50 transition"
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
        <div className="flex items-center gap-2">
          <span className="h-4 w-1 rounded-full bg-gradient-to-b from-amber-400 to-amber-600" aria-hidden />
          <h2 id={id} className="text-base font-bold text-gray-100 truncate">
            {title}
          </h2>
        </div>
        {subtitle ? (
          <p className="text-[11px] text-gray-500 mt-1 leading-snug ml-3">{subtitle}</p>
        ) : null}
      </div>
      {action}
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
 * Spotlight — mise en avant de la tendance #1 de la semaine
 * ──────────────────────────────────────────────────────────────────── */

function MusicSpotlight({
  section,
  onOpenProfile,
}: {
  section: MusicHomeWeeklySection;
  onOpenProfile: (userId: string) => void;
}) {
  const { t } = useTranslation();
  const album = section.albums[0];
  const track = !album ? section.tracks[0] : undefined;
  const reel = !album && !track ? section.reels[0] : undefined;

  const cover = album?.coverUrl ?? track?.albumArtUrl ?? reel?.posterUrl;
  const title = album?.title ?? track?.title ?? reel?.title;
  const creator = album?.creatorName ?? track?.creatorName ?? reel?.creatorName;
  const userId = album?.userId ?? track?.hostId ?? reel?.authorId;
  const upvotes = track?.upvoteCount ?? reel?.weeklyUpvoteCount;

  if (!title || !userId) return null;

  return (
    <button
      type="button"
      onClick={() => onOpenProfile(userId)}
      className="group relative w-full overflow-hidden rounded-2xl ring-1 ring-[#2a2a3a] text-left"
    >
      {cover ? (
        <img
          src={cover}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-40"
        />
      ) : null}
      <span className="absolute inset-0 bg-gradient-to-tr from-[#0b0b0f] via-[#0b0b0f]/85 to-amber-900/25" aria-hidden />
      <div className="relative flex items-center gap-4 p-4">
        <div className="relative shrink-0 size-24 sm:size-28 rounded-xl overflow-hidden bg-[#1a1a26] ring-1 ring-white/10">
          {cover ? (
            <img src={cover} alt="" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-3xl font-black text-amber-200/70">
              {title.slice(0, 1).toUpperCase()}
            </div>
          )}
          <span className="absolute bottom-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <PlayBadge />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
            {t('music.spotlightBadge', { defaultValue: 'Tendance #1' })}
          </span>
          <p className="mt-2 text-lg font-black text-white leading-tight line-clamp-2">{title}</p>
          <p className="text-xs text-gray-300 truncate mt-0.5">{creator}</p>
          {upvotes != null && upvotes > 0 ? (
            <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-gray-300 tabular-nums">
              <HeartGlyph className="w-3 h-3 text-rose-400" />
              {formatCompactCount(upvotes)}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────────
 * Contenu d'une section (reels / albums / morceaux)
 * ──────────────────────────────────────────────────────────────────── */

type LibraryTab = 'following' | 'library';

const DEFAULT_SECTIONS = ['weeklyTrend', 'discover', 'popular'] as const;
type DefaultSection = (typeof DEFAULT_SECTIONS)[number];
type HomeSectionKey = DefaultSection | LibraryTab;

function sectionHasContent(section: MusicHomeSection | MusicHomeWeeklySection): boolean {
  const reelCount = 'reels' in section ? section.reels.length : 0;
  return section.albums.length + section.tracks.length + reelCount > 0;
}

function MusicSectionContent({
  section,
  emptyMessage,
  onOpenProfile,
  rankedTracks = false,
}: {
  section: MusicHomeSection | MusicHomeWeeklySection;
  emptyMessage: string;
  onOpenProfile: (userId: string) => void;
  rankedTracks?: boolean;
}) {
  const { t } = useTranslation();
  const reels = 'reels' in section ? section.reels : [];

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

      {section.albums.length > 0 ? (
        <div>
          <ShelfLabel>{t('music.playlistsLabel', { defaultValue: 'Playlists & albums' })}</ShelfLabel>
          <HorizontalScrollCarousel
            itemCount={section.albums.length}
            ariaPrevLabel={t('music.scrollPrev', { defaultValue: 'Précédent' })}
            ariaNextLabel={t('music.scrollNext', { defaultValue: 'Suivant' })}
          >
            {section.albums.map((album) => (
              <MusicAlbumCard key={album.id} album={album} onOpenProfile={onOpenProfile} />
            ))}
          </HorizontalScrollCarousel>
        </div>
      ) : null}

      {section.tracks.length > 0 ? (
        <div>
          <ShelfLabel>{t('music.tracksLabel', { defaultValue: 'Morceaux' })}</ShelfLabel>
          <div className="rounded-xl border border-[#1e1e2f] bg-[#12121a]/80 px-2 divide-y divide-[#1e1e2f]/70">
            {section.tracks.map((track, i) => (
              <MusicTrackRow
                key={track.id}
                track={track}
                onOpenProfile={onOpenProfile}
                rank={rankedTracks ? i + 1 : undefined}
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
}: {
  data: MusicHomePayload | null;
  loading: boolean;
  onOpenProfile: (userId: string) => void;
}) {
  const { t } = useTranslation();
  const [libraryTab, setLibraryTab] = useState<LibraryTab | null>(null);

  const segments = useMemo(
    () =>
      [
        [null, t('music.tabForYou', { defaultValue: 'Pour toi' })],
        ['following', t('music.tabFollowing', { defaultValue: 'Abonnements' })],
        ['library', t('music.tabLibrary', { defaultValue: 'Ma bibliothèque' })],
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
    following: t('music.tabFollowing', { defaultValue: 'Abonnements' }),
    library: t('music.tabLibrary', { defaultValue: 'Ma bibliothèque' }),
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
      defaultValue: 'Les morceaux les plus likés apparaîtront ici.',
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

  return (
    <div className="space-y-6">
      <div
        className="flex gap-1 p-1 rounded-full bg-[#12121a] border border-[#1e1e2f]"
        role="tablist"
        aria-label={t('music.feedTabs', { defaultValue: 'Sections musique' })}
      >
        {segments.map(([id, label]) => {
          const selected = libraryTab === id;
          return (
            <button
              key={id ?? 'foryou'}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setLibraryTab(id)}
              className={`flex-1 min-h-11 px-3 py-2 rounded-full text-xs font-semibold transition touch-manipulation ${
                selected
                  ? 'bg-amber-500 text-black shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {libraryTab ? (
        <section aria-labelledby={`music-tab-${libraryTab}`}>
          <SectionHeader
            id={`music-tab-${libraryTab}`}
            title={sectionLabels[libraryTab]}
          />
          <MusicSectionContent
            section={data[libraryTab]}
            emptyMessage={emptyBySection[libraryTab]}
            onOpenProfile={onOpenProfile}
          />
        </section>
      ) : (
        <div className="space-y-7">
          {sectionHasContent(data.weeklyTrend) ? (
            <MusicSpotlight section={data.weeklyTrend} onOpenProfile={onOpenProfile} />
          ) : null}

          {creators.length > 0 ? (
            <section aria-labelledby="music-creators">
              <SectionHeader
                id="music-creators"
                title={t('music.creatorsTitle', { defaultValue: 'Créateurs à suivre' })}
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

          {DEFAULT_SECTIONS.map((sectionId) => (
            <section key={sectionId} aria-labelledby={`music-tab-${sectionId}`}>
              <SectionHeader
                id={`music-tab-${sectionId}`}
                title={sectionLabels[sectionId]}
                subtitle={
                  sectionId === 'weeklyTrend'
                    ? t('music.weeklyTrendSubtitle', {
                        defaultValue:
                          'Albums, morceaux et reels les plus upvotés cette semaine · reset lundi',
                      })
                    : sectionId === 'popular'
                      ? t('music.popularSubtitle', {
                          defaultValue: 'Le classement des morceaux les plus aimés',
                        })
                      : undefined
                }
              />
              <MusicSectionContent
                section={sectionId === 'weeklyTrend' ? data.weeklyTrend : data[sectionId]}
                emptyMessage={emptyBySection[sectionId]}
                onOpenProfile={onOpenProfile}
                rankedTracks={sectionId === 'popular' || sectionId === 'weeklyTrend'}
              />
            </section>
          ))}
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
        <div>
          <ShelfLabel>{t('music.playlistsLabel', { defaultValue: 'Playlists & albums' })}</ShelfLabel>
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
      ) : null}
      {tracks.length > 0 ? (
        <div>
          <ShelfLabel>{t('music.tracksLabel', { defaultValue: 'Morceaux' })}</ShelfLabel>
          <div className="rounded-xl border border-[#1e1e2f] bg-[#12121a]/80 px-2 divide-y divide-[#1e1e2f]/70">
            {tracks.map((track) => (
              <MusicTrackRow key={track.id} track={track} onOpenProfile={onOpenProfile} />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
