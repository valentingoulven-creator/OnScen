import { useEffect, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import { isPlatformConnected } from '../lib/platformConnect';

import { api } from '../lib/api';

import { getSocket } from '../lib/socket';

import { ChatPanel } from '../components/ChatPanel';

import { HostRatingBlock } from '../components/HostRatingBlock';

import { SalonPlaybackPanel } from '../components/SalonPlaybackPanel';
import { SalonQueueSection } from '../components/SalonQueueSection';
import { SalonProposalsSection } from '../components/SalonProposalsSection';
import { useSalonQueueSync } from '../hooks/useSalonQueueSync';

import type { DmContact, PlaybackState, Salon } from '../types';



export function SalonPage({ salonId, onBack }: { salonId: string; onBack: () => void }) {

  const { user, token, setUserFromProfile } = useAuth();

  const [salon, setSalon] = useState<Salon | null>(null);

  const [contacts, setContacts] = useState<DmContact[]>([]);

  const [startingLive, setStartingLive] = useState(false);

  const [accessSaving, setAccessSaving] = useState(false);
  const [skipping, setSkipping] = useState(false);



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

    if (!salon || !user || salon.canJoin === false) return;

    const socket = getSocket();

    socket.emit('join_salon', { salonId: salon.id, userId: user.id, username: user.username });

    const onDenied = () => {

      alert('Accès refusé');

      onBack();

    };

    const onUpdated = (updated: Salon) => {

      if (updated.id === salon.id) {

        setSalon((prev) =>
          prev
            ? {
                ...prev,
                ...updated,
                playbackState: updated.playbackState ?? prev.playbackState,
                queue: updated.queue ?? prev.queue,
              }
            : prev
        );

      }

    };

    const onPlayback = (state: PlaybackState) => {

      setSalon((prev) => (prev ? { ...prev, playbackState: state } : prev));

    };

    socket.on('salon_join_denied', onDenied);

    socket.on('salon_updated', onUpdated);

    socket.on('playback_sync', onPlayback);

    return () => {

      socket.emit('leave_salon', { salonId: salon.id });

      socket.off('salon_join_denied', onDenied);

      socket.off('salon_updated', onUpdated);

      socket.off('playback_sync', onPlayback);

    };

  }, [salon?.id, user?.id]);



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

  if (!salon) return <div className="p-8 text-center text-gray-400">Chargement...</div>;

  const allowedSet = new Set(salon.allowedUserIds ?? []);

  const playback = salon.playbackState;

  const applyPlayback = (state: PlaybackState) => {
    setSalon((prev) => (prev ? { ...prev, playbackState: state } : prev));
  };

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



  return (

    <div className="flex flex-col min-h-dvh bg-[#0b0b0f]">

      <header className="flex items-center gap-3 p-4 border-b border-[#1e1e2f]">

        <button onClick={onBack} className="text-gray-400 hover:text-white text-xl">

          ←

        </button>

        <img src={playback.albumArtUrl} alt="" className="w-10 h-10 rounded-lg" />

        <div className="flex-1">

          <h1 className="font-bold text-white">{salon.title}</h1>

          <p className="text-xs text-gray-400">

            {salon.hostName} · {salon.platform === 'spotify' ? '🎧 Spotify' : '▶️ YouTube'}

          </p>

        </div>

        {isHost && !salon.isLive && (

          <button

            onClick={startLive}

            disabled={startingLive}

            className="px-3 py-1.5 bg-red-600 rounded-full text-xs font-bold text-white"

          >

            Go Live

          </button>

        )}

      </header>



      <div className="p-4 flex flex-col items-center">

        <span

          className={`text-xs px-3 py-1 rounded-full mb-3 ${

            salon.accessMode === 'public'

              ? 'bg-green-500/10 text-green-400 border border-green-500/30'

              : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'

          }`}

        >

          {salon.accessMode === 'public' ? '🌍 Salon public' : '🔒 Sur invitation'}

        </span>



        <img

          src={playback.albumArtUrl}

          alt=""

          className="w-48 h-48 rounded-2xl shadow-2xl object-cover mb-4"

        />

        <h2 className="text-xl font-bold">{playback.title}</h2>

        <p className="text-gray-400">{playback.artist}</p>

        <div className="mt-3 flex gap-2">

          <span className="text-xs px-3 py-1 rounded-full bg-[#1a1a26] border border-[#2d2d3d] capitalize">

            {salon.platform}

          </span>

          <span className="text-xs px-3 py-1 rounded-full bg-purple-900/30 text-purple-300">

            {salon.listenersCount} auditeurs

          </span>

        </div>



        <SalonPlaybackPanel

          salon={salon}

          token={token}

          isHost={isHost}

          userPlatforms={user?.connectedPlatforms}

          onUserUpdated={setUserFromProfile}

          onPlaybackStateChange={applyPlayback}

        />

        <section className="mt-4 w-full max-w-md bg-[#12121a] border border-[#1e1e2f] rounded-2xl p-4 space-y-4">
          {isHost && (
            <div className="flex items-center gap-2 pb-2 border-b border-[#1e1e2f]">
              <span className="text-xs font-bold text-purple-300 uppercase">Panneau host</span>
              <span className="text-[10px] text-gray-500">
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

          <section className="mt-4 w-full max-w-md bg-[#12121a] border border-[#1e1e2f] rounded-2xl p-4">

            <h3 className="text-xs font-bold text-purple-400 uppercase mb-3">Gérer l&apos;accès</h3>

            <div className="flex gap-2 mb-3">

              <button

                type="button"

                disabled={accessSaving}

                onClick={() => setAccessMode('public')}

                className={`flex-1 py-2 rounded-lg text-xs font-bold ${

                  salon.accessMode === 'public' ? 'bg-purple-600 text-white' : 'bg-[#1a1a26] text-gray-400'

                }`}

              >

                Public

              </button>

              <button

                type="button"

                disabled={accessSaving}

                onClick={() => setAccessMode('invite')}

                className={`flex-1 py-2 rounded-lg text-xs font-bold ${

                  salon.accessMode === 'invite' ? 'bg-purple-600 text-white' : 'bg-[#1a1a26] text-gray-400'

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



        <div className="mt-4 w-full max-w-md px-2">

          <HostRatingBlock hostId={salon.hostId} hostName={salon.hostName} isBot={salon.isBot} salonId={salon.id} />

        </div>

      </div>



      <div className="flex-1 min-h-[200px] border-t border-[#1e1e2f] flex flex-col">

        <p className="text-xs font-bold text-purple-400 px-4 py-2 uppercase tracking-wider">Chat du salon</p>

        <div className="flex-1 min-h-0">

          <ChatPanel

            roomId={salon.id}

            roomType="salon"

            userId={user!.id}

            userName={user!.username}

            token={token ?? undefined}

          />

        </div>

      </div>

    </div>

  );

}

