import { useCallback, useEffect, useState, type RefObject } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { isPlatformConnected } from '../lib/platformConnect';
import { HostRatingBlock } from './HostRatingBlock';
import { ShareSalonLink } from './ShareSalonLink';
import { SalonPlaybackPanel } from './SalonPlaybackPanel';
import { MapSalonListenControls, MAP_SALON_OUTLINE_BUTTON_CLASS } from './MapSalonListenControls';
import { UserAvatarOnline } from './UserAvatarOnline';
import { UsernameDisplay } from './UsernameDisplay';
import { useSalonQueueSync } from '../hooks/useSalonQueueSync';
import type { PlaybackState, Salon } from '../types';

const PLATFORM_BADGE: Record<
  'spotify' | 'youtube',
  { label: string; className: string }
> = {
  spotify: {
    label: 'Spotify',
    className: 'text-[#8b8baf] border-white/10 bg-[#131318]',
  },
  youtube: {
    label: 'YouTube',
    className: 'text-[#8b8baf] border-white/10 bg-[#131318]',
  },
};

interface MapSalonListenSheetProps {
  salon: Salon;
  expanded: boolean;
  sheetRef: RefObject<HTMLDivElement | null>;
  onExpand: () => void;
  onCollapse: () => void;
  onClose: () => void;
  /** Ouvre la page plein écran Salon (SalonPage). */
  onOpenFullExperience: () => void;
  onPlaybackStateChange: (state: PlaybackState) => void;
  onSalonUpdate: (salon: Salon) => void;
  /** false quand l'onglet Carte n'est pas au premier plan (évite le chevauchement avec Reels). */
  mapPlaybackActive?: boolean;
  /** Ouvre le profil hôte (overlay carte) sans fermer la fiche écoute. */
  onOpenHostProfile?: () => void;
}

export function MapSalonListenSheet({
  salon,
  expanded,
  sheetRef,
  onExpand,
  onCollapse,
  onClose,
  onOpenFullExperience,
  onPlaybackStateChange,
  onSalonUpdate,
  mapPlaybackActive = true,
  onOpenHostProfile,
}: MapSalonListenSheetProps) {
  const { user, token, setUserFromProfile } = useAuth();
  const isHost = Boolean(salon.isHost ?? (salon.hostId && salon.hostId === user?.id));

  const [isFav, setIsFav] = useState(false);
  const [notifsEnabled, setNotifsEnabled] = useState(true);
  const [loadingFav, setLoadingFav] = useState(false);

  useEffect(() => {
    if (!token || isHost || !salon.hostId) return;
    api.getFavoriteStatus(token, salon.hostId).then((r) => {
      setIsFav(r.isFavorite);
      setNotifsEnabled(r.notificationsEnabled);
    }).catch(() => {});
  }, [token, salon.hostId, isHost]);

  const toggleFav = async () => {
    if (!token || loadingFav) return;
    setLoadingFav(true);
    try {
      if (isFav) {
        await api.removeFavorite(token, salon.hostId);
        setIsFav(false);
      } else {
        const r = await api.addFavorite(token, salon.hostId);
        setIsFav(true);
        setNotifsEnabled(r.notificationsEnabled);
      }
    } catch {
      /* ignore */
    } finally {
      setLoadingFav(false);
    }
  };

  const toggleNotifs = async () => {
    if (!token || !isFav) return;
    const next = !notifsEnabled;
    setNotifsEnabled(next);
    try {
      await api.setFavoriteNotifications(token, salon.hostId, next);
    } catch {
      setNotifsEnabled(!next);
    }
  };

  const hostCanControl = Boolean(
    isHost && isPlatformConnected(user?.connectedPlatforms, salon.platform)
  );

  const applyPlayback = useCallback(
    (state: PlaybackState) => {
      onPlaybackStateChange(state);
      onSalonUpdate({ ...salon, playbackState: state });
    },
    [onPlaybackStateChange, onSalonUpdate, salon]
  );

  const {
    queue,
    proposals,
    loadingProposals,
    skipNext,
    playQueueItem,
    acceptProposal,
    rejectProposal,
    proposeTrack,
  } = useSalonQueueSync(salon.id, token, isHost, salon.queue);

  const playback = salon.playbackState;
  const trackPlatform = playback.platform ?? salon.platform;
  const platformBadge = PLATFORM_BADGE[trackPlatform];
  const listenersLabel = `${salon.listenersCount} auditeur${salon.listenersCount !== 1 ? 's' : ''}`;
  const showSalonTitle =
    salon.title.trim().length > 0 &&
    salon.title.trim().toLowerCase() !== playback.title.trim().toLowerCase();

  const showHeaderHostActions = Boolean(onOpenHostProfile || (user && !isHost));

  const headerHostActions = (
    <div className="flex items-center gap-0.5 shrink-0">
      {user && !isHost && (
        <button
          type="button"
          onClick={toggleFav}
          disabled={loadingFav}
          title={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          aria-label={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          className={`p-1.5 rounded-lg transition active:scale-90 ${
            isFav
              ? 'text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10'
              : 'text-[#6b6b8a] hover:text-yellow-400 hover:bg-white/10'
          } ${loadingFav ? 'opacity-50' : ''}`}
        >
          <svg
            viewBox="0 0 24 24"
            className="w-4 h-4"
            fill={isFav ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
      {user && !isHost && isFav && (
        <button
          type="button"
          onClick={toggleNotifs}
          title={notifsEnabled ? 'Désactiver les notifications' : 'Activer les notifications'}
          aria-label={
            notifsEnabled
              ? 'Désactiver les notifications pour cet hôte'
              : 'Activer les notifications pour cet hôte'
          }
          className={`p-1.5 rounded-lg transition active:scale-90 ${
            notifsEnabled
              ? 'text-[#8b8baf] hover:text-white hover:bg-white/10'
              : 'text-[#6b6b8a]/50 hover:text-[#8b8baf] hover:bg-white/10'
          }`}
        >
          {notifsEnabled ? (
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path
                d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5M9 17v1a3 3 0 0 0 6 0v-1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path
                d="M13.73 21a2 2 0 0 1-3.46 0M18.63 13A17.89 17.89 0 0 1 18 8M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14M18 8a6 6 0 0 0-9.33-5M1 1l22 22"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
      )}
      {onOpenHostProfile ? (
        <button
          type="button"
          onClick={onOpenHostProfile}
          className="shrink-0 rounded-full ring-2 ring-white/10 hover:ring-[#8b8baf]/35 transition active:scale-95"
          aria-label={`Profil de ${salon.hostName}`}
        >
          <UserAvatarOnline
            userId={salon.hostId}
            avatarUrl={salon.hostAvatarUrl}
            username={salon.hostName}
            size="xl"
            isLive={salon.isLive}
          />
        </button>
      ) : null}
    </div>
  );

  return (
    <div
      ref={sheetRef}
      className={`absolute bottom-0 left-0 right-0 z-30 bg-[#0e0e14]/97 border-t border-white/10 backdrop-blur-md flex flex-col shadow-[0_-12px_40px_rgba(0,0,0,0.5)] ${
        expanded ? 'max-h-[72dvh]' : 'max-h-[52dvh]'
      }`}
    >
      {/* En-tête : hôte, pochette, morceau, actions */}
      <div className="shrink-0 px-3 py-3 border-b border-white/10">
        <div className="flex items-start gap-3 min-w-0">
          <button
            type="button"
            onClick={expanded ? onCollapse : onExpand}
            className="flex flex-1 min-w-0 items-start gap-3 text-left rounded-xl hover:bg-white/[0.04] py-0.5 pr-1 transition"
            aria-expanded={expanded}
            aria-label={expanded ? 'Réduire le lecteur' : 'Développer le lecteur'}
          >
            <img
              src={playback.albumArtUrl}
              alt=""
              className="w-16 h-16 rounded-lg object-cover shrink-0 shadow-lg shadow-black/50 ring-1 ring-white/10"
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
                    username={salon.hostName}
                    usernameColor={salon.hostUsernameColor}
                    usernameWaveFrom={salon.hostUsernameWaveFrom}
                    usernameWaveTo={salon.hostUsernameWaveTo}
                    className="truncate"
                  />
                  {showSalonTitle ? (
                    <span className="shrink-0 text-[#6b6b8a] truncate">· {salon.title}</span>
                  ) : null}
                </span>
                <HostRatingBlock
                  hostId={salon.hostId}
                  hostName={salon.hostName}
                  isBot={salon.isBot}
                  salonId={salon.id}
                  inline
                  hideLabel
                  compact
                  mutedStars
                />
              </p>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span
                  className={`text-[9px] font-medium px-1.5 py-0.5 rounded-md border capitalize ${platformBadge.className}`}
                >
                  {platformBadge.label}
                </span>
                {salon.isLive && (
                  <span className="text-[9px] font-semibold text-[#c47a7a] bg-[#1a1214] px-1.5 py-0.5 rounded-md border border-white/10">
                    LIVE
                  </span>
                )}
                <span className="text-[10px] text-[#8b8baf] tabular-nums">
                  {listenersLabel}
                </span>
              </div>
            </div>
            <span className="text-[#6b6b8a] text-[10px] shrink-0 self-center px-0.5" aria-hidden>
              {expanded ? '▼' : '▲'}
            </span>
          </button>

          <div className="flex items-start gap-1 shrink-0 self-start pt-0.5">
            {showHeaderHostActions ? headerHostActions : null}
            {expanded && (
              <button
                type="button"
                onClick={onOpenFullExperience}
                className={MAP_SALON_OUTLINE_BUTTON_CLASS}
                title="Ouvrir le salon en plein écran"
              >
                Salon
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#6b6b8a] hover:text-white hover:bg-white/10 transition shrink-0"
              aria-label="Fermer l'écoute et le profil"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {!expanded && (
        <div className="shrink-0 px-3 py-2.5 border-b border-white/10">
          <MapSalonListenControls
            salon={salon}
            onPlaybackStateChange={applyPlayback}
            playbackActive={mapPlaybackActive}
            autoplayAllowed={true}
            showYoutubeLink
            minimalControls
            onOpenSalon={onOpenFullExperience}
          />
        </div>
      )}

      {expanded && (
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <div className="px-3 pt-2 pb-1 flex flex-wrap items-center gap-2">
            {salon.isLive && (
              <span className="text-[10px] font-semibold text-[#c47a7a] bg-[#1a1214] px-2 py-0.5 rounded-md border border-white/10">
                LIVE
              </span>
            )}
            {(salon.isHost || salon.hostId === user?.id) && (
              <ShareSalonLink
                salonId={salon.id}
                salonTitle={salon.title}
                hostName={salon.hostName}
                variant="compact"
              />
            )}
          </div>

          <div className="px-3 pb-2">
            <SalonPlaybackPanel
              salon={salon}
              token={token}
              isHost={isHost}
              userPlatforms={user?.connectedPlatforms}
              onUserUpdated={setUserFromProfile}
              onPlaybackStateChange={applyPlayback}
              onQueueChange={(q) => onSalonUpdate({ ...salon, queue: q })}
              hostCanControl={hostCanControl}
              queue={queue}
              proposals={proposals}
              loadingProposals={loadingProposals}
              skipping={false}
              onSkip={hostCanControl ? skipNext : undefined}
              onPlayQueueItem={hostCanControl ? playQueueItem : undefined}
              onAcceptProposal={
                hostCanControl
                  ? async (proposalId, playNow) => {
                      await acceptProposal(proposalId, playNow);
                    }
                  : undefined
              }
              onRejectProposal={hostCanControl ? rejectProposal : undefined}
              onProposeTrack={!isHost ? proposeTrack : undefined}
              mapInline
              playbackActive={mapPlaybackActive}
            />
          </div>

        </div>
      )}
    </div>
  );
}
