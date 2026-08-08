import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { copyShareLink, getCompositionShareUrl } from '../lib/shareLink';
import { notifyMusicFavoritesChanged } from '../lib/musicFavoritesEvents';
import type { PlayerTrack } from '../context/MusicPlayerContext';
import type { UserAlbumItem } from './UserCompositionsSection';
import { ShareLinkMenu } from './ShareLinkMenu';
import { ShareToUserSheet } from './ShareToUserSheet';
import { ReportContentModal } from './ReportContentModal';

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 6 6 6-6 6" />
    </svg>
  );
}

function MenuRowIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex items-center justify-center w-9 h-9 rounded-full bg-white/5 text-gray-300 shrink-0">
      {children}
    </span>
  );
}

function MenuRow({
  icon,
  label,
  onClick,
  danger,
  trailing,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-semibold transition-colors touch-manipulation ${
        danger ? 'text-red-400 hover:bg-red-500/10 active:bg-red-500/15' : 'text-white hover:bg-white/5 active:bg-white/10'
      }`}
    >
      <MenuRowIcon>{icon}</MenuRowIcon>
      <span className="flex-1 min-w-0 truncate">{label}</span>
      {trailing}
    </button>
  );
}

/**
 * Menu « ⋯ » du lecteur audio global — actions façon Spotify sur le morceau en cours :
 * ajouter à une playlist (albums possédés par l'utilisateur), ajouter à la file
 * d'attente, partager, copier le lien, signaler. Auto-suffisant : gère lui-même les
 * sous-modales (partage, envoi à un utilisateur, signalement) et son propre toast.
 */
export function MusicTrackOptionsMenu({
  open,
  onClose,
  track,
  token,
  onAddToQueue,
}: {
  open: boolean;
  onClose: () => void;
  track: PlayerTrack;
  token: string | null;
  onAddToQueue: (track: PlayerTrack) => void;
}) {
  const { t } = useTranslation();
  const [view, setView] = useState<'menu' | 'playlists'>('menu');
  const [albums, setAlbums] = useState<UserAlbumItem[] | null>(null);
  const [albumsLoading, setAlbumsLoading] = useState(false);
  const [albumsError, setAlbumsError] = useState<string | null>(null);
  const [savingAlbumId, setSavingAlbumId] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [shareToUserOpen, setShareToUserOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) {
      setView('menu');
      setAlbums(null);
      setAlbumsError(null);
    }
  }, [open]);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    []
  );

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  };

  const ensureShareUrl = async (): Promise<string> => {
    if (shareUrl) return shareUrl;
    const url = await getCompositionShareUrl(track.hostId, track.id);
    setShareUrl(url);
    return url;
  };

  const openPlaylists = () => {
    setView('playlists');
    if (!token || albums) return;
    setAlbumsLoading(true);
    setAlbumsError(null);
    void api
      .getMyAlbums(token)
      .then((res) => setAlbums(res.albums))
      .catch(() => setAlbumsError(t('music.playlistsLoadError', { defaultValue: 'Impossible de charger tes playlists' })))
      .finally(() => setAlbumsLoading(false));
  };

  const addToPlaylist = async (album: UserAlbumItem) => {
    if (!token || savingAlbumId) return;
    setSavingAlbumId(album.id);
    try {
      const res = await api.addTrackToPlaylist(token, album.id, track.id);
      showToast(
        res.alreadySaved
          ? t('music.trackAlreadyInPlaylist', { title: album.title, defaultValue: 'Déjà dans « {{title}} »' })
          : t('music.trackAddedToPlaylist', { title: album.title, defaultValue: 'Ajouté à « {{title}} »' })
      );
      notifyMusicFavoritesChanged();
      onClose();
    } catch (e) {
      showToast(e instanceof Error ? e.message : t('music.playlistAddError', { defaultValue: 'Ajout impossible' }));
    } finally {
      setSavingAlbumId(null);
    }
  };

  const handleAddToQueue = () => {
    onAddToQueue(track);
    showToast(t('music.trackAddedToQueue', { defaultValue: 'Ajouté à la file d’attente' }));
    onClose();
  };

  const handleShare = async () => {
    await ensureShareUrl();
    setShareOpen(true);
  };

  const handleCopyLink = async () => {
    const url = await ensureShareUrl();
    const ok = await copyShareLink(url);
    showToast(ok ? t('share.copied', { defaultValue: 'Lien copié' }) : t('share.copyFailed', { defaultValue: 'Copie impossible' }));
    onClose();
  };

  const reportContext = {
    targetUserId: track.hostId,
    targetUsername: track.artist,
    roomType: 'track' as const,
    roomId: track.id,
  };

  const mainMenu =
    open && !shareOpen && !shareToUserOpen && !reportOpen ? (
        <div
          className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="music-track-options-title"
        >
          <button type="button" className="absolute inset-0" aria-label={t('common.close')} onClick={onClose} />
          <div className="relative w-full max-w-md bg-[#12121a] border border-[#2d2d3d] rounded-t-2xl sm:rounded-2xl max-h-[90dvh] overflow-y-auto pb-[env(safe-area-inset-bottom)]">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1e1e2f] sticky top-0 bg-[#12121a] z-10">
              {view === 'playlists' && (
                <button
                  type="button"
                  onClick={() => setView('menu')}
                  aria-label={t('common.back', { defaultValue: 'Retour' })}
                  className="text-gray-400 hover:text-white p-1 -ml-1"
                >
                  <ChevronRightIcon className="w-5 h-5 rotate-180" />
                </button>
              )}
              <div className="flex-1 min-w-0">
                <h2 id="music-track-options-title" className="font-bold text-white text-sm truncate">
                  {view === 'playlists'
                    ? t('music.addToPlaylistTitle', { defaultValue: 'Ajouter à une playlist' })
                    : track.title}
                </h2>
                {view === 'menu' && <p className="text-xs text-gray-500 truncate">{track.artist}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-gray-400 hover:text-white px-2"
                aria-label={t('common.close')}
              >
                ✕
              </button>
            </div>

            {view === 'menu' ? (
              <ul className="py-2">
                <li>
                  <MenuRow
                    label={t('music.addToPlaylist', { defaultValue: 'Ajouter à une playlist' })}
                    onClick={openPlaylists}
                    trailing={<ChevronRightIcon className="w-4 h-4 text-gray-500" />}
                    icon={
                      <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm12-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      </svg>
                    }
                  />
                </li>
                <li>
                  <MenuRow
                    label={t('music.addToQueue', { defaultValue: 'Ajouter à la file d’attente' })}
                    onClick={handleAddToQueue}
                    icon={
                      <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h11M4 12h11M4 18h7M19 9v9m0 0-3-3m3 3 3-3" />
                      </svg>
                    }
                  />
                </li>
                <li>
                  <MenuRow
                    label={t('share.title', { defaultValue: 'Partager' })}
                    onClick={() => void handleShare()}
                    icon={
                      <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="18" cy="5" r="3" />
                        <circle cx="6" cy="12" r="3" />
                        <circle cx="18" cy="19" r="3" />
                        <path strokeLinecap="round" d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98" />
                      </svg>
                    }
                  />
                </li>
                <li>
                  <MenuRow
                    label={t('share.copyLink', { defaultValue: 'Copier le lien' })}
                    onClick={() => void handleCopyLink()}
                    icon={
                      <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    }
                  />
                </li>
                <li className="mt-1 pt-1 border-t border-[#1e1e2f]">
                  <MenuRow
                    label={t('profile.report', { defaultValue: 'Signaler' })}
                    onClick={() => setReportOpen(true)}
                    danger
                    icon={
                      <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
                      </svg>
                    }
                  />
                </li>
              </ul>
            ) : (
              <div className="py-2">
                {albumsLoading && (
                  <p className="px-4 py-6 text-center text-sm text-gray-500">
                    {t('common.loading', { defaultValue: 'Chargement…' })}
                  </p>
                )}
                {!albumsLoading && albumsError && (
                  <p className="px-4 py-6 text-center text-sm text-red-400">{albumsError}</p>
                )}
                {!albumsLoading && !albumsError && albums && albums.length === 0 && (
                  <p className="px-4 py-6 text-center text-sm text-gray-500">
                    {t('music.noPlaylistsYet', {
                      defaultValue: 'Aucune playlist. Crée un album depuis l’onglet Discographie de ton profil.',
                    })}
                  </p>
                )}
                {!albumsLoading && !albumsError && albums && albums.length > 0 && (
                  <ul>
                    {albums.map((album) => (
                      <li key={album.id}>
                        <button
                          type="button"
                          onClick={() => void addToPlaylist(album)}
                          disabled={savingAlbumId === album.id}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/5 active:bg-white/10 transition-colors touch-manipulation disabled:opacity-50"
                        >
                          {album.coverUrl ? (
                            <img
                              src={album.coverUrl}
                              alt=""
                              loading="lazy"
                              className="w-10 h-10 rounded-lg object-cover bg-[#1a1a26] shrink-0"
                            />
                          ) : (
                            <span className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-900/40 to-[#1a1a26] flex items-center justify-center text-xs font-bold text-purple-200/80 shrink-0">
                              {album.title.slice(0, 1).toUpperCase()}
                            </span>
                          )}
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-semibold text-white truncate">{album.title}</span>
                            <span className="block text-xs text-gray-500 truncate">
                              {t('music.trackCount', { count: album.trackCount, defaultValue: '{{count}} morceau(x)' })}
                            </span>
                          </span>
                          {savingAlbumId === album.id && (
                            <span className="text-xs text-gray-500 shrink-0">
                              {t('common.loading', { defaultValue: '…' })}
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
    ) : null;

  const toastNode = toast ? (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[130] pointer-events-none pb-[env(safe-area-inset-bottom)]">
      <div className="bg-[#1e1e2f]/95 border border-[#2d2d3d] text-white text-xs font-semibold px-4 py-2 rounded-full shadow-xl backdrop-blur-sm whitespace-nowrap">
        {toast}
      </div>
    </div>
  ) : null;

  const portal = (node: ReactNode) =>
    node && typeof document !== 'undefined' ? createPortal(node, document.body) : node;

  return (
    <>
      {portal(mainMenu)}

      {shareOpen && shareUrl && (
        <ShareLinkMenu
          open
          onClose={() => {
            setShareOpen(false);
            onClose();
          }}
          url={shareUrl}
          title={`${track.title} — OnScen`}
          text={`${track.title} · ${track.artist}`}
          onToast={showToast}
          overlayZClass="z-[115]"
          onSendToUser={token ? () => setShareToUserOpen(true) : undefined}
        />
      )}

      {shareToUserOpen && shareUrl && token && (
        <ShareToUserSheet
          open
          onBack={() => setShareToUserOpen(false)}
          onClose={() => {
            setShareToUserOpen(false);
            setShareOpen(false);
            onClose();
          }}
          token={token}
          shareUrl={shareUrl}
          shareText={`${track.title} · ${track.artist}`}
          onToast={showToast}
          overlayZClass="z-[115]"
        />
      )}

      {reportOpen && (
        <ReportContentModal
          context={reportContext}
          onClose={() => {
            setReportOpen(false);
            onClose();
          }}
        />
      )}

      {portal(toastNode)}
    </>
  );
}
