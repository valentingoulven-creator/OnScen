import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import { isPlatformConnected } from '../lib/platformConnect';
import { mergeRemotePlaybackState } from '../lib/salonPlayback';

import { api } from '../lib/api';

import { getSocket, onSocketConnect } from '../lib/socket';

import { ChatRoomProvider, ChatMessagesView, ChatInputBar, ChatModals } from '../components/ChatPanel';
import { UsernameDisplay } from '../components/UsernameDisplay';

import { HostRatingBlock } from '../components/HostRatingBlock';

import { RoomTheaterLayout } from '../components/RoomTheaterLayout';
import { SalonPlaybackPanel } from '../components/SalonPlaybackPanel';
import { SalonYouTubePlaylist } from '../components/SalonYouTubePlaylist';
import { SalonYouTubeSearch } from '../components/SalonYouTubeSearch';
import { SalonQueueSection } from '../components/SalonQueueSection';
import { SalonProposalsSection } from '../components/SalonProposalsSection';
import { useSalonQueueSync } from '../hooks/useSalonQueueSync';

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



export function SalonPage({ salonId, onBack }: { salonId: string; onBack: () => void }) {

  const { user, token, setUserFromProfile } = useAuth();

  const [salon, setSalon] = useState<Salon | null>(null);

  const [contacts, setContacts] = useState<DmContact[]>([]);

  const [startingLive, setStartingLive] = useState(false);

  const [accessSaving, setAccessSaving] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [chatHidden, setChatHidden] = useState(false);
  const [chatMinimized, setChatMinimized] = useState(false);

  const [sessionEnded, setSessionEnded] = useState(false);
  const [durationWarning, setDurationWarning] = useState(false);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  const loadSalon = () => {

    if (!token) return;

    api.getSalon(token, salonId).then((r) => setSalon(r.salon)).catch((e) => {

      alert(e instanceof Error ? e.message : 'Salon inaccessible');

      onBack();

    });

  };



  useEffect(() => {

    loadSalon();

    if (token) api.getDmContacts(token).then((r) => setContacts(r.contacts));

  }, [salonId, token]);



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
        window.setTimeout(() => setDurationWarning(false), 10000);
      }
    };
    socket.on('salon_ended', onEnded);
    socket.on('session_warning', onWarning);
    return () => {
      socket.off('salon_ended', onEnded);
      socket.off('session_warning', onWarning);
    };
  }, [salonId]);



  useEffect(() => {

    if (!salon || !user || salon.canJoin === false) return;

    const socket = getSocket();

    const joinSalon = () => {
      socket.emit('join_salon', { salonId: salon.id, userId: user.id, username: user.username });
    };

    joinSalon();

    const onDenied = () => {

      alert('Accès refusé');

      onBack();

    };

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

    socket.on('salon_join_denied', onDenied);
    socket.on('salon_updated', onUpdated);
    const offReconnect = onSocketConnect(joinSalon);

    return () => {
      offReconnect();
      socket.emit('leave_salon', { salonId: salon.id });
      socket.off('salon_join_denied', onDenied);
      socket.off('salon_updated', onUpdated);
    };

  }, [salon?.id, user?.id, user?.username, onBack]);



  const startLive = async () => {

    if (!token) return;

    setStartingLive(true);

    try {

      await api.startLive(token, `Live — ${salon?.title}`);

      loadSalon();

    } catch (e) {

      alert(e instanceof Error ? e.message : 'Erreur');

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

      alert(e instanceof Error ? e.message : 'Erreur');

    } finally {

      setAccessSaving(false);

    }

  };



  const toggleGuest = async (userId: string, add: boolean) => {

    if (!token || !salon) return;

    try {

      const { salon: updated } = add

        ? await api.addSalonGuest(token, salon.id, userId)

        : await api.removeSalonGuest(token, salon.id, userId);

      setSalon(updated);

    } catch (e) {

      alert(e instanceof Error ? e.message : 'Erreur');

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
          onClick={onBack}
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
      else alert('File vide');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setSkipping(false);
    }
  };

  const handlePlayQueue = async (queueItemId: string) => {
    try {
      const state = await playQueueItem(queueItemId);
      if (state) applyPlayback(state);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const handleAccept = async (proposalId: string, playNow: boolean) => {
    const state = await acceptProposal(proposalId, playNow);
    if (state) applyPlayback(state);
  };



  const stageFooter = (
    <div className="p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`text-xs px-3 py-1 rounded-full ${
            salon.accessMode === 'public'
              ? 'bg-[#111e1a] text-[#6aab8a] border border-[#1e3328]'
              : 'bg-[#1e1a10] text-[#a0884a] border border-[#2e2510]'
          }`}
        >
          {salon.accessMode === 'public' ? '🌍 Salon public' : '🔒 Sur invitation'}
        </span>
        <span className="text-xs px-3 py-1 rounded-full bg-[#131318] border border-[#232330] text-gray-400 capitalize">
          {salon.platform}
        </span>
        <span className="text-xs px-3 py-1 rounded-full bg-[#131318] border border-[#232330] text-[#7878a0]">
          {salon.listenersCount} auditeurs
        </span>
      </div>

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
    <div className="flex flex-col h-dvh min-h-0 bg-[#0b0b0f] overflow-hidden">
      {durationWarning && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] max-w-[90vw] px-4 py-2.5 rounded-full bg-amber-950/90 border border-amber-500/40 text-sm text-amber-100 font-bold shadow-lg backdrop-blur text-center">
          ⚠ Session se terminera dans 15 min
        </div>
      )}
      <header className="shrink-0 flex items-center gap-3 px-3 py-2.5 border-b border-[#1e1e2f]">
        <button type="button" onClick={onBack} className="text-gray-400 hover:text-white text-xl" aria-label="Retour">
          ←
        </button>
        <img src={playback.albumArtUrl} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
        <div className="flex-1 min-w-0">
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
              <span className="shrink-0 text-[#6b6b8a]">
                · {salon.platform === 'spotify' ? '🎧 Spotify' : '▶️ YouTube'}
              </span>
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
            Go Live
          </button>
        )}
      </header>

      <ChatRoomProvider {...chatProps}>
        <RoomTheaterLayout
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
              theaterMode
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

