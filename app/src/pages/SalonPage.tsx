import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../context/AuthContext';
import { isPlatformConnected } from '../lib/platformConnect';
import { mergeRemotePlaybackState } from '../lib/salonPlayback';

import { api } from '../lib/api';

import { getSocket } from '../lib/socket';

import { ChatRoomProvider, ChatMessagesView, ChatInputBar, ChatModals } from '../components/ChatPanel';
import { UsernameDisplay } from '../components/UsernameDisplay';

import { HostRatingBlock } from '../components/HostRatingBlock';

import { RoomTheaterLayout } from '../components/RoomTheaterLayout';
import { SalonPlaybackPanel } from '../components/SalonPlaybackPanel';
import { SalonYouTubePlaylist } from '../components/SalonYouTubePlaylist';
import { SalonYouTubeSearch } from '../components/SalonYouTubeSearch';
import { SalonSpotifySearch } from '../components/SalonSpotifySearch';
import { SalonSpotifyPlaylist } from '../components/SalonSpotifyPlaylist';
import { SalonQueueSection } from '../components/SalonQueueSection';
import { SalonProposalsSection } from '../components/SalonProposalsSection';
import { SalonSpotifyJamButton } from '../components/SalonSpotifyJamButton';
import { SalonInviteLinkCopy } from '../components/SalonInviteLinkCopy';
import { useSalonQueueSync } from '../hooks/useSalonQueueSync';

import { formatSalonAudienceLabel } from '../lib/salonAudience';
import type { DmContact, PlaybackState, Salon } from '../types';

const SALON_MAX_DURATION_MS = 2 * 60 * 60 * 1000;

function formatRemaining(ms: number): string {
  if (ms <= 0) return '0 min';
  const totalMin = Math.ceil(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0 && m > 0) return `${h}h ${m} min`;
  if (h > 0) return `${h}h`;
  return `${m} min`;
}



export function SalonPage({
  salonId,
  onBack,
  onLeaveSalon,
  onMinimizeToMap,
  onSalonLoaded,
}: {
  salonId: string;
  onBack: () => void;
  /** Quitter définitivement le salon (session effacée). */
  onLeaveSalon?: () => void;
  /** Quitte le grand salon et rouvre la fiche carte (petit salon). */
  onMinimizeToMap?: (salonTitle?: string) => void;
  /** Titre chargé (barre retour header). */
  onSalonLoaded?: (salonTitle?: string) => void;
}) {

  const { user, token, setUserFromProfile } = useAuth();
  const { t } = useTranslation();

  const [salon, setSalon] = useState<Salon | null>(null);

  const [contacts, setContacts] = useState<DmContact[]>([]);

  const [startingLive, setStartingLive] = useState(false);

  const [accessSaving, setAccessSaving] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [chatHidden, setChatHidden] = useState(() => window.innerWidth < 640);
  const [chatMinimized, setChatMinimized] = useState(false);

  const [sessionEnded, setSessionEnded] = useState(false);
  const [durationWarning, setDurationWarning] = useState(false);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const warningTimerRef = useRef<number | null>(null);

  const loadSalon = useCallback(() => {
    if (!token) return;
    api.getSalon(token, salonId).then((r) => setSalon(r.salon)).catch((e) => {
      setToastMsg(e instanceof Error ? e.message : t('salon.inaccessible'));
      window.setTimeout(() => onBack(), 1500);
    });
  }, [token, salonId, onBack, t]);



  useEffect(() => {
    if (!toastMsg) return;
    const id = window.setTimeout(() => setToastMsg(null), 3000);
    return () => window.clearTimeout(id);
  }, [toastMsg]);

  useEffect(() => {
    loadSalon();
    if (token) api.getDmContacts(token).then((r) => setContacts(r.contacts));
  }, [loadSalon, token]);

  useEffect(() => {
    if (salon?.title) onSalonLoaded?.(salon.title);
  }, [salon?.title, onSalonLoaded]);



  useEffect(() => {
    if (!salon?.createdAt) return;
    const update = () => {
      const ms = salon.createdAt! + SALON_MAX_DURATION_MS - Date.now();
      setRemainingMs(Math.max(0, ms));
    };
    update();
    const id = window.setInterval(update, 60000);
    return () => window.clearInterval(id);
  }, [salon?.createdAt]);

  useEffect(() => {
    const socket = getSocket();
    const onEnded = (payload: { salonId: string; reason: string }) => {
      if (payload.salonId !== salonId) return;
      if (payload.reason === 'duration_limit') {
        setSessionEnded(true);
        setDurationWarning(false);
      }
    };
    const onWarning = (payload: { type: string; id: string }) => {
      if (payload.type === 'salon' && payload.id === salonId) {
        setDurationWarning(true);
        if (warningTimerRef.current !== null) window.clearTimeout(warningTimerRef.current);
        warningTimerRef.current = window.setTimeout(() => {
          warningTimerRef.current = null;
          setDurationWarning(false);
        }, 10000);
      }
    };
    socket.on('salon_ended', onEnded);
    socket.on('session_warning', onWarning);
    return () => {
      socket.off('salon_ended', onEnded);
      socket.off('session_warning', onWarning);
      if (warningTimerRef.current !== null) {
        window.clearTimeout(warningTimerRef.current);
        warningTimerRef.current = null;
      }
    };
  }, [salonId]);



  useEffect(() => {

    if (!salon || !user || salon.canJoin === false) return;

    const socket = getSocket();

    const onUpdated = (updated: Salon) => {
      if (updated.id !== salon.id) return;
      setSalon((prev) => {
        if (!prev) return prev;
        const { playbackState: incomingPs, queue: incomingQueue, ...rest } = updated;
        return {
          ...prev,
          ...rest,
          playbackState: incomingPs
            ? mergeRemotePlaybackState(prev.playbackState, incomingPs)
            : prev.playbackState,
          queue: incomingQueue ?? prev.queue,
        };
      });
    };

    socket.on('salon_updated', onUpdated);

    return () => {
      socket.off('salon_updated', onUpdated);
    };

  }, [salon?.id, user?.id, salon?.canJoin]);



  const startLive = async () => {

    if (!token) return;

    setStartingLive(true);

    try {

      await api.startLive(token, `Live — ${salon?.title}`);

      loadSalon();

    } catch (e) {

      setToastMsg(e instanceof Error ? e.message : 'Erreur');

    } finally {

      setStartingLive(false);

    }

  };



  const setAccessMode = async (mode: 'public' | 'invite') => {

    if (!token || !salon) return;

    setAccessSaving(true);

    try {

      const { salon: updated } = await api.updateSalonSettings(token, salon.id, { accessMode: mode });

      setSalon(updated);

    } catch (e) {

      setToastMsg(e instanceof Error ? e.message : 'Erreur');

    } finally {

      setAccessSaving(false);

    }

  };



  const toggleGuest = async (userId: string, add: boolean) => {

    if (!token || !salon) return;

    if (!add) {
      const guest = contacts.find((c) => c.id === userId);
      const name = guest?.username ?? 'cette personne';
      if (!window.confirm(`Retirer ${name} de la liste des invités autorisés ?`)) return;
    }

    try {

      const { salon: updated } = add

        ? await api.addSalonGuest(token, salon.id, userId)

        : await api.removeSalonGuest(token, salon.id, userId);

      setSalon(updated);

    } catch (e) {

      setToastMsg(e instanceof Error ? e.message : 'Erreur');

    }

  };

  const isHost = Boolean(salon && (salon.isHost ?? salon.hostId === user?.id));
  const hostCanControl = Boolean(
    isHost && salon && isPlatformConnected(user?.connectedPlatforms, salon.platform)
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
  } = useSalonQueueSync(salon?.id ?? salonId, token, isHost, salon?.queue);

  const applyPlayback = useCallback((state: PlaybackState) => {
    setSalon((prev) =>
      prev ? { ...prev, playbackState: mergeRemotePlaybackState(prev.playbackState, state) } : prev
    );
  }, []);

  if (!salon) return <div className="p-8 text-center text-gray-400">Chargement...</div>;

  if (sessionEnded) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 px-6 text-center bg-[#0b0b0f]">
        <p className="text-4xl">⏱</p>
        <p className="text-white font-bold text-lg">Session terminée</p>
        <p className="text-gray-400 text-sm max-w-sm">
          La durée maximale de 2 heures a été atteinte. Le salon a été automatiquement fermé.
        </p>
        <button
          type="button"
          onClick={onLeaveSalon ?? onBack}
          className="px-5 py-2.5 rounded-full bg-purple-600 text-white font-bold text-sm hover:bg-purple-500"
        >
          Retour
        </button>
      </div>
    );
  }

  const allowedSet = new Set(salon.allowedUserIds ?? []);

  const playback = salon.playbackState;

  const handleSkip = async () => {
    if (!isHost) return;
    setSkipping(true);
    try {
      const state = await skipNext();
      if (state) applyPlayback(state);
      else setToastMsg('File vide');
    } catch (e) {
      setToastMsg(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setSkipping(false);
    }
  };

  const handlePlayQueue = async (queueItemId: string) => {
    try {
      const state = await playQueueItem(queueItemId);
      if (state) applyPlayback(state);
    } catch (e) {
      setToastMsg(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const handleAccept = async (proposalId: string, playNow: boolean) => {
    try {
      const state = await acceptProposal(proposalId, playNow);
      if (state) applyPlayback(state);
    } catch (e) {
      setToastMsg(e instanceof Error ? e.message : 'Erreur');
    }
  };



  const stageFooter = (
    <div className="p-3 space-y-3">
      {salon.platform !== 'spotify' && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs px-3 py-1 rounded-full bg-[#131318] border border-[#232330] text-gray-400 capitalize">
            {salon.platform}
          </span>
        </div>
      )}

      {isHost && hostCanControl && salon.platform === 'youtube' && token && (
        <div className="space-y-3">
          <SalonYouTubeSearch
            salonId={salon.id}
            token={token}
            currentTitle={playback.title}
            currentArtist={playback.artist}
            onTrackChanged={applyPlayback}
          />
          <SalonYouTubePlaylist
            salonId={salon.id}
            token={token}
            onTrackChanged={applyPlayback}
          />
        </div>
      )}

      {isHost && hostCanControl && salon.platform === 'spotify' && token && (
        <div className="space-y-3">
          <SalonSpotifySearch
            salonId={salon.id}
            token={token}
            currentTitle={playback.title}
            currentArtist={playback.artist}
            onTrackChanged={applyPlayback}
            showCurrentTrack={false}
          />
          <SalonSpotifyPlaylist
            salonId={salon.id}
            token={token}
            onTrackChanged={applyPlayback}
          />
        </div>
      )}

      <section className="bg-[#12121a] border border-[#1e1e2f] rounded-2xl p-4 space-y-4">
        {isHost && (
          <div className="flex items-center gap-2 pb-2 border-b border-[#1e1e2f]">
            <span className="text-xs font-medium text-[#7878a0] uppercase tracking-wider">Panneau host</span>
            <span className="text-[10px] text-gray-600">
              {hostCanControl ? '— lecture, file & propositions' : '— connectez la plateforme du salon'}
            </span>
          </div>
        )}
        <SalonQueueSection
          queue={queue}
          isHost={hostCanControl}
          allowQueue={salon.allowQueue}
          onSkip={hostCanControl ? handleSkip : undefined}
          onPlayItem={hostCanControl ? handlePlayQueue : undefined}
          skipping={skipping}
        />
        <SalonProposalsSection
          isHost={hostCanControl}
          allowQueue={salon.allowQueue}
          proposals={proposals}
          loadingProposals={loadingProposals}
          onPropose={!isHost ? proposeTrack : undefined}
          onAccept={hostCanControl ? handleAccept : undefined}
          onReject={hostCanControl ? rejectProposal : undefined}
        />
      </section>

      {isHost && salon.accessMode === 'invite' && (
        <section className="bg-[#12121a] border border-[#1e1e2f] rounded-2xl p-4">
          <h3 className="text-xs font-medium text-[#7878a0] uppercase tracking-wider mb-3">Lien d&apos;invitation</h3>
          <SalonInviteLinkCopy salonId={salon.id} />
        </section>
      )}

      {hostCanControl && (
        <section className="bg-[#12121a] border border-[#1e1e2f] rounded-2xl p-4">
          <h3 className="text-xs font-medium text-[#7878a0] uppercase tracking-wider mb-3">Gérer l&apos;accès</h3>
          <div className="flex gap-2 mb-3">
            <button
              type="button"
              disabled={accessSaving}
              onClick={() => setAccessMode('public')}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition ${
                salon.accessMode === 'public' ? 'bg-[#42426a] text-white' : 'bg-[#131318] border border-[#232330] text-gray-500 hover:text-gray-300'
              }`}
            >
              Public
            </button>
            <button
              type="button"
              disabled={accessSaving}
              onClick={() => setAccessMode('invite')}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition ${
                salon.accessMode === 'invite' ? 'bg-[#42426a] text-white' : 'bg-[#131318] border border-[#232330] text-gray-500 hover:text-gray-300'
              }`}
            >
              Invitation
            </button>
          </div>
          {salon.accessMode === 'invite' && (
            <div className="max-h-32 overflow-y-auto space-y-1">
              <p className="text-[10px] text-gray-500 mb-1">Personnes autorisées :</p>
              {contacts.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm text-white">
                  <input
                    type="checkbox"
                    checked={allowedSet.has(c.id)}
                    onChange={(e) => toggleGuest(c.id, e.target.checked)}
                  />
                  {c.username}
                </label>
              ))}
            </div>
          )}
        </section>
      )}

    </div>
  );

  const chatProps = {
    roomId: salon.id,
    roomType: 'salon' as const,
    userId: user!.id,
    userName: user!.username,
    token: token ?? undefined,
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full bg-[#0b0b0f] overflow-hidden">
      {durationWarning && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] max-w-[90vw] px-4 py-2.5 rounded-full bg-amber-950/90 border border-amber-500/40 text-sm text-amber-100 font-bold shadow-lg backdrop-blur text-center">
          ⚠ Session se terminera dans 15 min
        </div>
      )}
      {toastMsg && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[70] pointer-events-none max-w-[90vw]">
          <div className="px-4 py-2.5 rounded-full bg-[#1a1a26]/95 border border-white/15 text-sm text-white shadow-lg backdrop-blur-md text-center">
            {toastMsg}
          </div>
        </div>
      )}
      <header className="shrink-0 flex items-center gap-3 px-3 pb-2.5 pt-[max(0.75rem,env(safe-area-inset-top))] border-b border-[#1e1e2f]">
        <button type="button" onClick={onBack} className="text-gray-400 hover:text-white text-xl" aria-label="Réduire">
          ←
        </button>
        <img
          src={playback.albumArtUrl}
          alt=""
          className="w-9 h-9 rounded-lg object-cover shrink-0 bg-[#1a1a26]"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
        <div className="flex-1 min-w-0">
          {salon.platform === 'spotify' ? (
            <p className="text-[11px] text-gray-400 truncate flex items-center gap-2 min-w-0">
              <span className="truncate inline-flex items-center gap-1 min-w-0">
                <UsernameDisplay
                  username={salon.hostName}
                  usernameColor={salon.hostUsernameColor}
                  usernameWaveFrom={salon.hostUsernameWaveFrom}
                  usernameWaveTo={salon.hostUsernameWaveTo}
                  className="truncate"
                />
                <span className="shrink-0 text-[#6b6b8a]">· 🎧 Spotify</span>
              </span>
              <HostRatingBlock
                hostId={salon.hostId}
                hostName={salon.hostName}
                isBot={salon.isBot}
                salonId={salon.id}
                inline
                hideLabel
                compact
              />
            </p>
          ) : (
            <>
              <h1 className="font-bold text-white truncate text-sm">{salon.title}</h1>
              <p className="text-[11px] text-gray-400 truncate flex items-center gap-2 min-w-0">
                <span className="truncate inline-flex items-center gap-1 min-w-0">
                  <UsernameDisplay
                    username={salon.hostName}
                    usernameColor={salon.hostUsernameColor}
                    usernameWaveFrom={salon.hostUsernameWaveFrom}
                    usernameWaveTo={salon.hostUsernameWaveTo}
                    className="truncate"
                  />
                  <span className="shrink-0 text-[#6b6b8a]">· ▶️ YouTube</span>
                </span>
                <HostRatingBlock
                  hostId={salon.hostId}
                  hostName={salon.hostName}
                  isBot={salon.isBot}
                  salonId={salon.id}
                  inline
                  hideLabel
                  compact
                />
              </p>
            </>
          )}
          <p className="text-[10px] mt-0.5 text-[#6b6b8a] tabular-nums">
            {formatSalonAudienceLabel(salon.listenersCount, t)}
          </p>
          {remainingMs !== null && remainingMs > 0 && (
            <p className={`text-[10px] mt-0.5 ${remainingMs <= 15 * 60 * 1000 ? 'text-amber-400' : 'text-[#5a5a7a]'}`}>
              ⏱ {formatRemaining(remainingMs)} restantes
            </p>
          )}
        </div>
        {isHost && !salon.isLive && (
          <button
            type="button"
            onClick={startLive}
            disabled={startingLive}
            className="shrink-0 px-3 py-1.5 bg-red-600 rounded-full text-xs font-bold text-white"
          >
            Live
          </button>
        )}
        <div className="flex items-center gap-1.5 shrink-0">
          {salon.platform === 'spotify' && (
            <SalonSpotifyJamButton
              salon={salon}
              token={token}
              isHost={isHost}
              onSalonUpdated={setSalon}
              onToast={setToastMsg}
            />
          )}
          {onMinimizeToMap && (
            <button
              type="button"
              onClick={() => onMinimizeToMap(salon.title)}
              className="salon-header-icon-btn"
              aria-label="Réduire le salon"
              title="Réduire le salon"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <polyline
                  points="6,9 12,15 18,9"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
          {onLeaveSalon && (
            <button
              type="button"
              onClick={onLeaveSalon}
              className="shrink-0 px-2.5 py-1.5 rounded-full text-[10px] font-semibold text-gray-400 border border-[#2a2a3a] hover:text-white hover:border-gray-500 transition"
            >
              {t('salon.leaveSalon')}
            </button>
          )}
        </div>
      </header>

      <ChatRoomProvider {...chatProps}>
        <RoomTheaterLayout
          variant={salon.platform === 'spotify' ? 'queue-chat' : 'theater'}
          chatHidden={chatHidden}
          onToggleChat={() => setChatHidden((h) => !h)}
          chatTitle="Chat du salon"
          chatMinimized={chatMinimized}
          onToggleMinimize={() => setChatMinimized((m) => !m)}
          stage={
            <SalonPlaybackPanel
              salon={salon}
              token={token}
              isHost={isHost}
              userPlatforms={user?.connectedPlatforms}
              onUserUpdated={setUserFromProfile}
              onPlaybackStateChange={applyPlayback}
              theaterMode={salon.platform !== 'spotify'}
              salonQueueLayout={salon.platform === 'spotify'}
            />
          }
          stageFooter={stageFooter}
          chat={
            <div className="flex flex-col h-full min-h-0">
              <ChatMessagesView />
            </div>
          }
          chatInput={<ChatInputBar />}
        />
        <ChatModals />
      </ChatRoomProvider>
    </div>
  );

}

