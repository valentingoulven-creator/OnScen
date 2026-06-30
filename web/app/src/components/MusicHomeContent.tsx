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
  MusicSearchPayload,
  MusicTrackItem,
} from '../lib/musicTypes';

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

export function MusicTrackRow({
  track,
  onOpenProfile,
}: {
  track: MusicTrackItem;
  onOpenProfile?: (userId: string) => void;
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
      className="w-full flex items-center gap-3 min-h-[52px] py-2 text-left rounded-lg hover:bg-white/[0.03] active:bg-white/[0.05]"
    >
      <MusicCover url={track.albumArtUrl} title={track.title} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-100 truncate">{track.title}</p>
        <p className="text-xs text-gray-500 truncate">
          {subtitle}
          {track.upvoteCount != null && track.upvoteCount > 0
            ? ` · ${formatCompactCount(track.upvoteCount)} ♥`
            : null}
        </p>
      </div>
    </button>
  );
}

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
      className="shrink-0 w-[9.5rem] sm:w-[10.5rem] flex flex-col text-left"
    >
      <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-[#1a1a26] ring-1 ring-[#2a2a3a]">
        {album.coverUrl ? (
          <img src={album.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-amber-900/35 via-[#1a1a26] to-[#0b0b0f] flex items-center justify-center">
            <span className="text-2xl font-black text-amber-200/70" aria-hidden>
              {album.title.slice(0, 1).toUpperCase()}
            </span>
          </div>
        )}
        <span className="absolute bottom-1.5 right-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-black/70 text-white tabular-nums">
          {t('music.trackCount', {
            defaultValue: '{{count}} morceau(x)',
            count: album.trackCount,
          })}
        </span>
      </div>
      <p className="mt-1.5 text-xs font-semibold text-gray-100 truncate">{album.title}</p>
      <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
        <img src={avatar} alt="" className="size-4 rounded-full shrink-0 object-cover bg-[#1a1a26]" />
        <p className="text-[10px] text-gray-500 truncate">{album.creatorName}</p>
      </div>
    </button>
  );
}

function SectionEmpty({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-[#1e1e2f] bg-[#12121a]/80 px-3 py-4">
      <p className="text-[11px] text-gray-500 leading-snug">{message}</p>
    </div>
  );
}

function SectionHeader({
  id,
  title,
  action,
}: {
  id: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 mb-2">
      <h2 id={id} className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
        {title}
      </h2>
      {action}
    </div>
  );
}

type FeedTab = 'discover' | 'following' | 'library' | 'popular';

function sectionHasContent(section: MusicHomeSection): boolean {
  return section.albums.length + section.tracks.length > 0;
}

function MusicSectionContent({
  section,
  emptyMessage,
  onOpenProfile,
}: {
  section: MusicHomeSection;
  emptyMessage: string;
  onOpenProfile: (userId: string) => void;
}) {
  const { t } = useTranslation();

  if (!sectionHasContent(section)) {
    return <SectionEmpty message={emptyMessage} />;
  }

  return (
    <div className="space-y-4">
      {section.albums.length > 0 ? (
        <div>
          <h3 className="text-[10px] font-semibold text-gray-500 mb-2 uppercase tracking-wide">
            {t('music.playlistsLabel', { defaultValue: 'Playlists & albums' })}
          </h3>
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
          <h3 className="text-[10px] font-semibold text-gray-500 mb-2 uppercase tracking-wide">
            {t('music.tracksLabel', { defaultValue: 'Morceaux' })}
          </h3>
          <div className="rounded-xl border border-[#1e1e2f] bg-[#12121a]/80 px-2 divide-y divide-[#1e1e2f]">
            {section.tracks.map((track) => (
              <MusicTrackRow key={track.id} track={track} onOpenProfile={onOpenProfile} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

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
  const [tab, setTab] = useState<FeedTab>('discover');

  const tabs = useMemo(
    () =>
      [
        ['discover', t('music.tabDiscover', { defaultValue: 'Découvrir' })],
        ['following', t('music.tabFollowing', { defaultValue: 'Abonnements' })],
        ['library', t('music.tabLibrary', { defaultValue: 'Ma bibliothèque' })],
        ['popular', t('music.tabPopular', { defaultValue: 'Populaire' })],
      ] as const,
    [t],
  );

  const emptyByTab: Record<FeedTab, string> = {
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
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-[#12121a] ms-skeleton" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const activeSection = data[tab];

  return (
    <div className="space-y-4">
      <div
        className="flex gap-1 p-1 rounded-xl bg-[#12121a] border border-[#1e1e2f] overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label={t('music.feedTabs', { defaultValue: 'Sections musique' })}
      >
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`shrink-0 min-h-11 px-3.5 py-2 rounded-lg text-xs font-semibold transition touch-manipulation ${
              tab === id
                ? 'bg-amber-500/15 text-amber-200 border border-amber-500/30'
                : 'text-gray-500 hover:text-gray-300 border border-transparent'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <section aria-labelledby={`music-tab-${tab}`}>
        <SectionHeader id={`music-tab-${tab}`} title={tabs.find(([id]) => id === tab)?.[1] ?? ''} />
        <MusicSectionContent
          section={activeSection}
          emptyMessage={emptyByTab[tab]}
          onOpenProfile={onOpenProfile}
        />
      </section>
    </div>
  );
}

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
    <section aria-labelledby="music-search-results" className="space-y-4">
      <SectionHeader
        id="music-search-results"
        title={t('music.searchResults', { defaultValue: 'Résultats' })}
      />
      {albums.length > 0 ? (
        <HorizontalScrollCarousel
          itemCount={albums.length}
          ariaPrevLabel={t('music.scrollPrev', { defaultValue: 'Précédent' })}
          ariaNextLabel={t('music.scrollNext', { defaultValue: 'Suivant' })}
        >
          {albums.map((album) => (
            <MusicAlbumCard key={album.id} album={album} onOpenProfile={onOpenProfile} />
          ))}
        </HorizontalScrollCarousel>
      ) : null}
      {tracks.length > 0 ? (
        <div className="rounded-xl border border-[#1e1e2f] bg-[#12121a]/80 px-2 divide-y divide-[#1e1e2f]">
          {tracks.map((track) => (
            <MusicTrackRow key={track.id} track={track} onOpenProfile={onOpenProfile} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
