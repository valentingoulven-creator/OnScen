/**
 * Routeur d’entrée création carte (tel) — live / event / salon.
 * Gates : auth, conflit hôte salon↔live. Les callbacks métier restent ceux de HomePage.
 */
import { useCallback, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { emitLeaveSalon } from './useSalonSocketMembership';
import { clearPersistedSalonSession } from '../lib/activeSalonSession';

export type MapCreateKind = 'live' | 'event' | 'salon';

export type MapCreateHandoff = {
  kind: MapCreateKind;
  title: string;
  description: string;
  confirmLabel: string;
};

export function useMapCreateIntent(actions: {
  onStartLive: () => void;
  onCreateEvent: () => void;
  onCreateSalon: () => void;
}) {
  const { token, user, refreshUser } = useAuth();
  const [handoff, setHandoff] = useState<MapCreateHandoff | null>(null);
  const [handoffLoading, setHandoffLoading] = useState(false);
  const [handoffError, setHandoffError] = useState<string | null>(null);

  const run = useCallback(
    (kind: MapCreateKind) => {
      if (kind === 'live') actions.onStartLive();
      else if (kind === 'event') actions.onCreateEvent();
      else actions.onCreateSalon();
    },
    [actions]
  );

  const startCreate = useCallback(
    (kind: MapCreateKind) => {
      if (!token) return;

      const hostingSalon = Boolean(user?.salonId);
      const hostingLive = Boolean(user?.isLive && user.liveId);

      if (kind === 'live' && hostingSalon) {
        setHandoffError(null);
        setHandoff({
          kind,
          title: 'Quitter le salon ?',
          description: 'Tu héberges déjà un salon. Quitte-le pour démarrer un live.',
          confirmLabel: 'Quitter et continuer',
        });
        return;
      }

      if (kind === 'salon' && hostingLive) {
        setHandoffError(null);
        setHandoff({
          kind,
          title: 'Arrêter le live ?',
          description: 'Tu es déjà en live. Arrête-le pour créer un salon.',
          confirmLabel: 'Arrêter et continuer',
        });
        return;
      }

      run(kind);
    },
    [run, token, user?.isLive, user?.liveId, user?.salonId]
  );

  const confirmHandoff = useCallback(async () => {
    if (!handoff || !token) return;
    setHandoffLoading(true);
    setHandoffError(null);
    try {
      if (handoff.kind === 'live' && user?.salonId) {
        emitLeaveSalon(user.salonId);
        clearPersistedSalonSession();
      }
      if (handoff.kind === 'salon' && user?.liveId) {
        await api.stopLive(token);
        await refreshUser();
      }
      const kind = handoff.kind;
      setHandoff(null);
      run(kind);
    } catch (e) {
      setHandoffError(e instanceof Error ? e.message : 'Impossible de continuer');
    } finally {
      setHandoffLoading(false);
    }
  }, [handoff, refreshUser, run, token, user?.liveId, user?.salonId]);

  const cancelHandoff = useCallback(() => {
    if (handoffLoading) return;
    setHandoff(null);
    setHandoffError(null);
  }, [handoffLoading]);

  return { startCreate, handoff, handoffLoading, handoffError, confirmHandoff, cancelHandoff };
}
