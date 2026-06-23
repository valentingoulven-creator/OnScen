import { useCallback, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { dicebearAdventurerAvatar } from '../lib/avatarUrl';
import { formatCompactCount } from '../lib/formatCount';
import { HorizontalScrollCarousel } from './HorizontalScrollCarousel';
import type {
  MusicArtistItem,
  MusicHomePayload,
  MusicLiveItem,
  MusicSalonItem,
  MusicSearchHit,
  MusicTrackItem,
} from '../lib/musicTypes';

function trackExternalUrl(track: MusicTrackItem): string | null {
  if (!track.trackId) return null;
  if (track.platform === 'youtube') return `https://www.youtube.com/watch?v=${track.trackId}`;
  return null;
}

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
  subtitle,
  onOpenLive,
  onOpenSalon,
  onOpenProfile,
}: {
  track: MusicTrackItem | MusicSearchHit;
  subtitle?: string;
  onOpenLive?: (liveId: string) => void;
  onOpenSalon?: (salonId: string) => void;
  onOpenProfile?: (userId: string) => void;
}) {
  const isSearch = 'kind' in track;
  const title = track.title;
  const artist = track.artist;
  const albumArtUrl = isSearch ? track.albumArtUrl : track.albumArtUrl;

  const handleClick = useCallback(() => {
    if (isSearch) {
      window.open(track.externalUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    if (track.liveId && onOpenLive) {
      onOpenLive(track.liveId);
      return;
    }
    if (track.salonId && onOpenSalon) {
      onOpenSalon(track.salonId);
      return;
    }
    if (track.hostId && track.source === 'composition' && onOpenProfile) {
      onOpenProfile(track.hostId);
      return;
    }
    const url = trackExternalUrl(track);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }, [isSearch, track, onOpenLive, onOpenSalon, onOpenProfile]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-full flex items-center gap-3 min-h-[52px] py-2 text-left rounded-lg hover:bg-white/[0.03] active:bg-white/[0.05]"
    >
      <MusicCover url={albumArtUrl} title={title} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-100 truncate">{title}</p>
        <p className="text-xs text-gray-500 truncate">
          {subtitle ?? artist}
          {!isSearch && track.upvoteCount != null && track.upvoteCount > 0
            ? ` · ${formatCompactCount(track.upvoteCount)} ♥`
            : null}
        </p>
      </div>
    </button>
  );
}

function MusicLiveCard({
  live,
  onOpenLive,
}: {
  live: MusicLiveItem;
  onOpenLive: (liveId: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={() => onOpenLive(live.id)}
      className="shrink-0 w-[9.5rem] sm:w-[10.5rem] flex flex-col text-left"
    >
      <div className="relative aspect-video w-full rounded-lg overflow-hidden bg-[#1a1a26]">
        {live.albumArtUrl ? (
          <img src={live.albumArtUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a26] to-[#0b0b0f]" />
        )}
        <span className="absolute top-1.5 left-1.5 size-2 rounded-full bg-red-500 ring-2 ring-red-500/40 live-indicator-dot" />
        <span className="absolute bottom-1.5 right-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-black/70 text-white">
          {formatCompactCount(live.viewersCount)}
        </span>
      </div>
      <p className="mt-1.5 text-xs font-semibold text-gray-100 truncate">{live.hostName}</p>
      <p className="text-[10px] text-gray-500 truncate">
        {live.trackTitle ?? live.title}
      </p>
      {live.distanceKm != null ? (
        <p className="text-[10px] text-amber-400/80 truncate">
          {t('music.distanceKm', { defaultValue: '{{km}} km', km: live.distanceKm.toFixed(1) })}
        </p>
      ) : null}
    </button>
  );
}

function MusicSalonCard({
  salon,
  onOpenSalon,
}: {
  salon: MusicSalonItem;
  onOpenSalon: (salonId: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={() => onOpenSalon(salon.id)}
      className="shrink-0 w-[9.5rem] sm:w-[10.5rem] flex flex-col text-left"
    >
      <div className="relative aspect-video w-full rounded-lg overflow-hidden bg-[#1a1a26]">
        {salon.albumArtUrl ? (
          <img src={salon.albumArtUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-violet-900/30 to-[#0b0b0f]" />
        )}
        <span className="absolute bottom-1.5 right-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-black/70 text-white">
          {formatCompactCount(salon.listenersCount)}
        </span>
      </div>
      <p className="mt-1.5 text-xs font-semibold text-gray-100 truncate">{salon.title}</p>
      <p className="text-[10px] text-gray-500 truncate">{salon.hostName}</p>
      {salon.distanceKm != null ? (
        <p className="text-[10px] text-amber-400/80 truncate">
          {t('music.distanceKm', { defaultValue: '{{km}} km', km: salon.distanceKm.toFixed(1) })}
        </p>
      ) : null}
    </button>
  );
}

function MusicArtistChip({
  artist,
  onOpenLive,
  onOpenProfile,
}: {
  artist: MusicArtistItem;
  onOpenLive?: (liveId: string) => void;
  onOpenProfile?: (userId: string) => void;
}) {
  const avatar =
    artist.avatarUrl ??
    (artist.id.startsWith('favorite:') ? undefined : dicebearAdventurerAvatar(artist.name));
  const isFavorite = artist.id.startsWith('favorite:');

  const handleClick = () => {
    if (artist.liveId && onOpenLive) {
      onOpenLive(artist.liveId);
      return;
    }
    if (!isFavorite && onOpenProfile) onOpenProfile(artist.id);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isFavorite && !artist.liveId}
      className="shrink-0 w-[4.75rem] flex flex-col items-center gap-1.5 disabled:opacity-70"
    >
      <div className="relative size-14 rounded-full overflow-hidden bg-[#1a1a26] ring-2 ring-[#2d2d3d]">
        {avatar ? (
          <img src={avatar} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-sm font-bold text-amber-300/90">
            {artist.name.slice(0, 1).toUpperCase()}
          </div>
        )}
        {artist.isLive ? (
          <span className="absolute bottom-0.5 right-0.5 size-2.5 rounded-full bg-red-500 ring-2 ring-[#0b0b0f]" />
        ) : null}
      </div>
      <span className="text-[10px] text-gray-300 text-center line-clamp-2 leading-tight w-full">
        {artist.name}
      </span>
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

export function MusicHomeSections({
  data,
  loading,
  onOpenMap,
  onOpenLive,
  onOpenSalon,
  onOpenProfile,
}: {
  data: MusicHomePayload | null;
  loading: boolean;
  onOpenMap?: () => void;
  onOpenLive: (liveId: string) => void;
  onOpenSalon: (salonId: string) => void;
  onOpenProfile: (userId: string) => void;
}) {
  const { t } = useTranslation();

  const nearbyHasContent = useMemo(() => {
    if (!data) return false;
    const n = data.nearby;
    return n.lives.length + n.salons.length + n.tracks.length + n.artists.length > 0;
  }, [data]);

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

  return (
    <div className="space-y-6">
      <section aria-labelledby="music-section-nearby">
        <SectionHeader
          id="music-section-nearby"
          title={t('music.sectionNearby', { defaultValue: 'Découverte autour de moi' })}
          action={
            onOpenMap ? (
              <button
                type="button"
                onClick={onOpenMap}
                className="text-[10px] font-semibold text-amber-400/90 hover:text-amber-300 min-h-[44px] px-2"
              >
                {t('music.openMap', { defaultValue: 'Voir la carte' })}
              </button>
            ) : null
          }
        />
        <p className="text-[10px] text-gray-600 mb-2">{data.geoLabel}</p>
        {!nearbyHasContent ? (
          <SectionEmpty
            message={t('music.emptyNearby', {
              defaultValue: 'Aucun live ni salon actif dans ta zone pour le moment.',
            })}
          />
        ) : (
          <div className="space-y-4">
            {data.nearby.lives.length > 0 ? (
              <HorizontalScrollCarousel
                itemCount={data.nearby.lives.length}
                ariaPrevLabel={t('music.scrollPrev', { defaultValue: 'Précédent' })}
                ariaNextLabel={t('music.scrollNext', { defaultValue: 'Suivant' })}
              >
                {data.nearby.lives.map((live) => (
                  <MusicLiveCard key={live.id} live={live} onOpenLive={onOpenLive} />
                ))}
              </HorizontalScrollCarousel>
            ) : null}
            {data.nearby.salons.length > 0 ? (
              <HorizontalScrollCarousel
                itemCount={data.nearby.salons.length}
                ariaPrevLabel={t('music.scrollPrev', { defaultValue: 'Précédent' })}
                ariaNextLabel={t('music.scrollNext', { defaultValue: 'Suivant' })}
              >
                {data.nearby.salons.map((salon) => (
                  <MusicSalonCard key={salon.id} salon={salon} onOpenSalon={onOpenSalon} />
                ))}
              </HorizontalScrollCarousel>
            ) : null}
            {data.nearby.tracks.length > 0 ? (
              <div className="rounded-xl border border-[#1e1e2f] bg-[#12121a]/80 px-2 divide-y divide-[#1e1e2f]">
                {data.nearby.tracks.map((track) => (
                  <MusicTrackRow
                    key={track.id}
                    track={track}
                    onOpenLive={onOpenLive}
                    onOpenSalon={onOpenSalon}
                    onOpenProfile={onOpenProfile}
                  />
                ))}
              </div>
            ) : null}
            {data.nearby.artists.length > 0 ? (
              <HorizontalScrollCarousel
                itemCount={data.nearby.artists.length}
                ariaPrevLabel={t('music.scrollPrev', { defaultValue: 'Précédent' })}
                ariaNextLabel={t('music.scrollNext', { defaultValue: 'Suivant' })}
                scrollClassName="ms-hscroll-track min-w-0 w-full flex flex-nowrap gap-4 pb-1 overflow-x-auto"
              >
                {data.nearby.artists.map((artist) => (
                  <MusicArtistChip
                    key={artist.id}
                    artist={artist}
                    onOpenLive={onOpenLive}
                    onOpenProfile={onOpenProfile}
                  />
                ))}
              </HorizontalScrollCarousel>
            ) : null}
          </div>
        )}
      </section>

      <section aria-labelledby="music-section-likes">
        <SectionHeader
          id="music-section-likes"
          title={t('music.sectionLikes', { defaultValue: 'Mes likes' })}
        />
        {data.likes.tracks.length === 0 && data.likes.artists.length === 0 ? (
          <SectionEmpty
            message={t('music.emptyLikes', {
              defaultValue: 'Like des compositions ou ajoute des artistes favoris à ton profil.',
            })}
          />
        ) : (
          <div className="space-y-3">
            {data.likes.artists.length > 0 ? (
              <HorizontalScrollCarousel
                itemCount={data.likes.artists.length}
                ariaPrevLabel={t('music.scrollPrev', { defaultValue: 'Précédent' })}
                ariaNextLabel={t('music.scrollNext', { defaultValue: 'Suivant' })}
                scrollClassName="ms-hscroll-track min-w-0 w-full flex flex-nowrap gap-4 pb-1 overflow-x-auto"
              >
                {data.likes.artists.map((artist) => (
                  <MusicArtistChip key={artist.id} artist={artist} />
                ))}
              </HorizontalScrollCarousel>
            ) : null}
            {data.likes.tracks.length > 0 ? (
              <div className="rounded-xl border border-[#1e1e2f] bg-[#12121a]/80 px-2 divide-y divide-[#1e1e2f]">
                {data.likes.tracks.map((track) => (
                  <MusicTrackRow
                    key={track.id}
                    track={track}
                    onOpenProfile={onOpenProfile}
                  />
                ))}
              </div>
            ) : null}
          </div>
        )}
      </section>

      <section aria-labelledby="music-section-suggestions">
        <SectionHeader
          id="music-section-suggestions"
          title={t('music.sectionSuggestions', { defaultValue: 'Suggestions pour vous' })}
        />
        {data.suggestions.tracks.length === 0 &&
        data.suggestions.lives.length === 0 &&
        data.suggestions.artists.length === 0 ? (
          <SectionEmpty
            message={t('music.emptySuggestions', {
              defaultValue: 'Suis des hôtes ou renseigne tes artistes favoris pour des suggestions.',
            })}
          />
        ) : (
          <div className="space-y-4">
            {data.suggestions.lives.length > 0 ? (
              <HorizontalScrollCarousel
                itemCount={data.suggestions.lives.length}
                ariaPrevLabel={t('music.scrollPrev', { defaultValue: 'Précédent' })}
                ariaNextLabel={t('music.scrollNext', { defaultValue: 'Suivant' })}
              >
                {data.suggestions.lives.map((live) => (
                  <MusicLiveCard key={live.id} live={live} onOpenLive={onOpenLive} />
                ))}
              </HorizontalScrollCarousel>
            ) : null}
            {data.suggestions.artists.length > 0 ? (
              <HorizontalScrollCarousel
                itemCount={data.suggestions.artists.length}
                ariaPrevLabel={t('music.scrollPrev', { defaultValue: 'Précédent' })}
                ariaNextLabel={t('music.scrollNext', { defaultValue: 'Suivant' })}
                scrollClassName="ms-hscroll-track min-w-0 w-full flex flex-nowrap gap-4 pb-1 overflow-x-auto"
              >
                {data.suggestions.artists.map((artist) => (
                  <MusicArtistChip
                    key={artist.id}
                    artist={artist}
                    onOpenLive={onOpenLive}
                    onOpenProfile={onOpenProfile}
                  />
                ))}
              </HorizontalScrollCarousel>
            ) : null}
            {data.suggestions.tracks.length > 0 ? (
              <div className="rounded-xl border border-[#1e1e2f] bg-[#12121a]/80 px-2 divide-y divide-[#1e1e2f]">
                {data.suggestions.tracks.map((track) => (
                  <MusicTrackRow
                    key={track.id}
                    track={track}
                    onOpenLive={onOpenLive}
                    onOpenSalon={onOpenSalon}
                  />
                ))}
              </div>
            ) : null}
          </div>
        )}
      </section>

      <section aria-labelledby="music-section-new">
        <SectionHeader
          id="music-section-new"
          title={t('music.sectionNew', { defaultValue: 'Nouveautés' })}
        />
        {data.newReleases.length === 0 ? (
          <SectionEmpty message={t('music.emptyNew', { defaultValue: 'Aucune nouveauté pour le moment.' })} />
        ) : (
          <div className="rounded-xl border border-[#1e1e2f] bg-[#12121a]/80 px-2 divide-y divide-[#1e1e2f]">
            {data.newReleases.map((track) => (
              <MusicTrackRow key={track.id} track={track} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="music-section-charts">
        <SectionHeader
          id="music-section-charts"
          title={t('music.sectionCharts', { defaultValue: 'Classements' })}
        />
        <div className="space-y-4">
          {(['mostLiked', 'mostPlayed', 'trending'] as const).map((key) => {
            const tracks = data.charts[key];
            const labelKey =
              key === 'mostLiked'
                ? 'music.chartMostLiked'
                : key === 'mostPlayed'
                  ? 'music.chartMostPlayed'
                  : 'music.chartTrending';
            const defaultLabel =
              key === 'mostLiked' ? 'Les plus likés' : key === 'mostPlayed' ? 'Les plus joués' : 'Tendances';
            if (tracks.length === 0) return null;
            return (
              <div key={key}>
                <h3 className="text-[10px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                  {t(labelKey, { defaultValue: defaultLabel })}
                </h3>
                <div className="rounded-xl border border-[#1e1e2f] bg-[#12121a]/80 px-2 divide-y divide-[#1e1e2f]">
                  {tracks.slice(0, 5).map((track) => (
                    <MusicTrackRow
                      key={`${key}-${track.id}`}
                      track={track}
                      onOpenLive={onOpenLive}
                      onOpenSalon={onOpenSalon}
                      onOpenProfile={onOpenProfile}
                    />
                  ))}
                </div>
              </div>
            );
          })}
          {data.charts.mostLiked.length === 0 &&
          data.charts.mostPlayed.length === 0 &&
          data.charts.trending.length === 0 ? (
            <SectionEmpty
              message={t('music.emptyCharts', {
                defaultValue: 'Les classements se rempliront au fil des lives et likes.',
              })}
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}

export function MusicSearchResults({
  hits,
  loading,
  query,
}: {
  hits: MusicSearchHit[];
  loading: boolean;
  query: string;
}) {
  const { t } = useTranslation();

  if (query.trim().length < 2) return null;

  if (loading && hits.length === 0) {
    return (
      <div className="space-y-2 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 rounded-lg bg-[#12121a] ms-skeleton" />
        ))}
      </div>
    );
  }

  if (!loading && hits.length === 0) {
    return (
      <SectionEmpty
        message={t('music.searchEmpty', { defaultValue: 'Aucun résultat pour cette recherche.' })}
      />
    );
  }

  return (
    <section aria-labelledby="music-search-results">
      <SectionHeader
        id="music-search-results"
        title={t('music.searchResults', { defaultValue: 'Résultats' })}
      />
      <div className="rounded-xl border border-[#1e1e2f] bg-[#12121a]/80 px-2 divide-y divide-[#1e1e2f]">
        {hits.map((hit) => (
          <MusicTrackRow key={`${hit.kind}-${hit.id}`} track={hit} subtitle={hit.artist} />
        ))}
      </div>
    </section>
  );
}
