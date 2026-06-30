import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import {
  buildStoryAlbumLink,
  buildStoryCompositionLink,
} from '../lib/storyAppLink';
import type { UserAlbumItem, UserCompositionItem } from './UserCompositionsSection';

export interface StoryCatalogLinkSelection {
  url: string;
  label: string;
}

interface StoryCatalogLinkPickerProps {
  token: string;
  onSelect: (selection: StoryCatalogLinkSelection) => void;
}

function CatalogRow({
  title,
  subtitle,
  onClick,
}: {
  title: string;
  subtitle?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-xl bg-[#0b0b0f] border border-[#2d2d3d] px-3 py-2.5 text-left hover:border-purple-500/50 transition-colors"
    >
      <span className="w-9 h-9 shrink-0 rounded-lg bg-purple-500/15 flex items-center justify-center text-base" aria-hidden>
        ♪
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-white truncate">{title}</span>
        {subtitle ? (
          <span className="block text-[10px] text-gray-500 truncate">{subtitle}</span>
        ) : null}
      </span>
    </button>
  );
}

export function StoryCatalogLinkPicker({ token, onSelect }: StoryCatalogLinkPickerProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const [albums, setAlbums] = useState<UserAlbumItem[]>([]);
  const [tracks, setTracks] = useState<UserCompositionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void Promise.all([api.getMyAlbums(token), api.getMyCompositions(token)])
      .then(([albumsRes, tracksRes]) => {
        if (cancelled) return;
        setAlbums(albumsRes.albums);
        setTracks(tracksRes.compositions);
      })
      .catch((e) => {
        if (cancelled) return;
        setAlbums([]);
        setTracks([]);
        setError(e instanceof Error ? e.message : t('stories.catalogLinkLoadError', { defaultValue: 'Chargement impossible' }));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, t]);

  const q = query.trim().toLowerCase();
  const filteredAlbums = useMemo(
    () =>
      q
        ? albums.filter((a) => a.title.toLowerCase().includes(q))
        : albums,
    [albums, q]
  );
  const filteredTracks = useMemo(
    () =>
      q
        ? tracks.filter(
            (track) =>
              track.title.toLowerCase().includes(q) ||
              (track.artist?.toLowerCase().includes(q) ?? false)
          )
        : tracks,
    [tracks, q]
  );

  const pickAlbum = async (album: UserAlbumItem) => {
    if (!userId) return;
    const url = await buildStoryAlbumLink(userId, album.id);
    onSelect({ url, label: album.title });
  };

  const pickTrack = async (track: UserCompositionItem) => {
    if (!userId) return;
    const url = await buildStoryCompositionLink(userId, track.id);
    onSelect({ url, label: track.title });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <span className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return <p className="text-xs text-red-400 text-center py-4">{error}</p>;
  }

  if (!albums.length && !tracks.length) {
    return (
      <p className="text-xs text-gray-500 text-center py-4">
        {t('stories.catalogLinkEmpty', {
          defaultValue: 'Publiez un album ou un son sur votre profil pour le lier ici.',
        })}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-gray-500">
        {t('stories.catalogLinkHint', {
          defaultValue: 'Les viewers seront redirigés vers votre album ou son dans Soundy.',
        })}
      </p>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('stories.catalogLinkSearch', { defaultValue: 'Rechercher…' })}
        className="w-full rounded-xl bg-[#0b0b0f] border border-[#2d2d3d] px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/60"
      />
      {filteredAlbums.length ? (
        <section className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 px-0.5">
            {t('stories.catalogLinkAlbums', { defaultValue: 'Albums' })}
          </p>
          {filteredAlbums.map((album) => (
            <CatalogRow
              key={album.id}
              title={album.title}
              subtitle={t('stories.catalogLinkTrackCount', {
                count: album.trackCount,
                defaultValue: '{{count}} titre(s)',
              })}
              onClick={() => void pickAlbum(album)}
            />
          ))}
        </section>
      ) : null}
      {filteredTracks.length ? (
        <section className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 px-0.5">
            {t('stories.catalogLinkSongs', { defaultValue: 'Sons' })}
          </p>
          {filteredTracks.map((track) => (
            <CatalogRow
              key={track.id}
              title={track.title}
              subtitle={track.artist?.trim() || undefined}
              onClick={() => void pickTrack(track)}
            />
          ))}
        </section>
      ) : null}
    </div>
  );
}
