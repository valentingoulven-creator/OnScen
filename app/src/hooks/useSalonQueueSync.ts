import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import type { SalonQueueItem, SalonTrackProposal } from '../types';

export function useSalonQueueSync(
  salonId: string,
  token: string | null,
  isHost: boolean,
  initialQueue?: SalonQueueItem[]
) {
  const [queue, setQueue] = useState<SalonQueueItem[]>(initialQueue ?? []);
  const [proposals, setProposals] = useState<SalonTrackProposal[]>([]);
  const [loadingProposals, setLoadingProposals] = useState(false);

  useEffect(() => {
    setQueue(initialQueue ?? []);
  }, [salonId, initialQueue]);

  useEffect(() => {
    if (!token) return;
    api.getSalonQueue(token, salonId).then((r) => setQueue(r.queue)).catch(() => {});
  }, [token, salonId]);

  useEffect(() => {
    if (!token || !isHost) {
      setProposals([]);
      return;
    }
    setLoadingProposals(true);
    api
      .getSalonProposals(token, salonId)
      .then((r) => setProposals(r.proposals))
      .catch(() => setProposals([]))
      .finally(() => setLoadingProposals(false));
  }, [token, salonId, isHost]);

  useEffect(() => {
    const socket = getSocket();
    const onQueue = (payload: { salonId: string; queue: SalonQueueItem[] }) => {
      if (payload.salonId === salonId) setQueue(payload.queue);
    };
    const onProposals = (payload: { salonId: string; proposals: SalonTrackProposal[] }) => {
      if (payload.salonId === salonId && isHost) setProposals(payload.proposals);
    };
    socket.on('salon_queue_updated', onQueue);
    socket.on('salon_proposals_updated', onProposals);
    return () => {
      socket.off('salon_queue_updated', onQueue);
      socket.off('salon_proposals_updated', onProposals);
    };
  }, [salonId, isHost]);

  const skipNext = useCallback(async () => {
    if (!token) return null;
    const r = await api.salonPlaybackSkip(token, salonId);
    setQueue(r.queue);
    return r.playbackState;
  }, [token, salonId]);

  const playQueueItem = useCallback(
    async (queueItemId: string) => {
      if (!token) return null;
      const r = await api.salonPlayQueueItem(token, salonId, queueItemId);
      setQueue(r.queue);
      return r.playbackState;
    },
    [token, salonId]
  );

  const acceptProposal = useCallback(
    async (proposalId: string, playNow = false) => {
      if (!token) return;
      const r = await api.acceptSalonProposal(token, salonId, proposalId, playNow);
      setQueue(r.queue);
      setProposals((prev) => prev.filter((p) => p.id !== proposalId));
      return r.playbackState;
    },
    [token, salonId]
  );

  const rejectProposal = useCallback(
    async (proposalId: string) => {
      if (!token) return;
      await api.rejectSalonProposal(token, salonId, proposalId);
      setProposals((prev) => prev.filter((p) => p.id !== proposalId));
    },
    [token, salonId]
  );

  const proposeTrack = useCallback(
    async (body: { title: string; artist: string; spotifyUrl?: string; youtubeUrl?: string }) => {
      if (!token) return;
      await api.proposeSalonTrack(token, salonId, body);
    },
    [token, salonId]
  );

  return {
    queue,
    proposals,
    loadingProposals,
    skipNext,
    playQueueItem,
    acceptProposal,
    rejectProposal,
    proposeTrack,
  };
}
