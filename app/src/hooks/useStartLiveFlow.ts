import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import {
  getLivesGeo,
  MAP_GEO_CHANGED_EVENT,
  type LivesGeoPrefs,
} from '../lib/livesGeo';
import {
  getLiveMediaDraft,
  getLiveMediaPrefs,
  clearLiveMediaDraft,
} from '../lib/liveMediaPrefs';
import { isStripeConnectSkipped, setStripeConnectSkipped } from '../lib/stripeConnectSkip';

export interface UseStartLiveFlowOptions {
  onOpenLive: (liveId: string) => void;
  hasActiveSalon?: boolean;
  isActive?: boolean;
  /** Geo par défaut pour le modal média (ex. centre carte). */
  initialGeo?: LivesGeoPrefs;
}

export function useStartLiveFlow({
  onOpenLive,
  hasActiveSalon = false,
  isActive = true,
  initialGeo,
}: UseStartLiveFlowOptions) {
  const { token, user, setUserFromProfile } = useAuth();
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [mediaSetupOpen, setMediaSetupOpen] = useState(false);
  const [mediaSetupGeneration, setMediaSetupGeneration] = useState(0);
  const [stripeGateOpen, setStripeGateOpen] = useState(false);
  const [stripeGatePending, setStripeGatePending] = useState(false);
  const [legalGateOpen, setLegalGateOpen] = useState(false);
  const [geo, setGeo] = useState<LivesGeoPrefs>(() => initialGeo ?? getLivesGeo());

  const [stripeChecked, setStripeChecked] = useState(false);
  const [stripeSimulation, setStripeSimulation] = useState(false);
  const [stripeChargesEnabled, setStripeChargesEnabled] = useState<boolean | null>(null);

  const resolvedGeo = useMemo(
    () => initialGeo ?? geo,
    [geo, initialGeo]
  );

  useEffect(() => {
    if (initialGeo) setGeo(initialGeo);
  }, [initialGeo?.latitude, initialGeo?.longitude, initialGeo?.label, initialGeo?.source]);

  useEffect(() => {
    if (!isActive || !token || stripeChecked) return;
    api
      .getDonationsConfig(token)
      .then((config) => {
        setStripeSimulation(config.simulation ?? false);
        if (config.simulation) {
          setStripeChecked(true);
          return;
        }
        if (user?.stripeConnectAccountId) {
          api
            .getStripeConnectStatus(token)
            .then((s) => setStripeChargesEnabled(s.chargesEnabled ?? false))
            .catch(() => setStripeChargesEnabled(null))
            .finally(() => setStripeChecked(true));
        } else {
          setStripeChecked(true);
        }
      })
      .catch(() => setStripeChecked(true));
  }, [isActive, token, user?.stripeConnectAccountId, stripeChecked]);

  useEffect(() => {
    const syncGeo = () => setGeo(getLivesGeo());
    window.addEventListener(MAP_GEO_CHANGED_EVENT, syncGeo);
    return () => window.removeEventListener(MAP_GEO_CHANGED_EVENT, syncGeo);
  }, []);

  const launchLiveAfterSetup = useCallback(async () => {
    if (!token) return;
    setStarting(true);
    try {
      const prefs = getLiveMediaPrefs() ?? getLiveMediaDraft();
      const lat = prefs?.startLatitude ?? resolvedGeo.latitude;
      const lon = prefs?.startLongitude ?? resolvedGeo.longitude;
      const skipped = isStripeConnectSkipped() || stripeSimulation;
      const { live } = await api.startLive(token, `Live — ${user?.username}`, {
        latitude: lat,
        longitude: lon,
        stripeConnectSkipped: skipped || undefined,
      });
      clearLiveMediaDraft();
      setMediaSetupGeneration((g) => g + 1);
      onOpenLive(live.id);
    } catch (e) {
      setStartError(e instanceof Error ? e.message : 'Impossible de démarrer le live');
    } finally {
      setStarting(false);
    }
  }, [onOpenLive, resolvedGeo.latitude, resolvedGeo.longitude, stripeSimulation, token, user?.username]);

  const continueLiveStartAfterStripe = useCallback(() => {
    if (!user?.liveTermsAcceptedAt) {
      setLegalGateOpen(true);
      return;
    }
    setMediaSetupOpen(true);
  }, [user?.liveTermsAcceptedAt]);

  const handleStripeConnectSkip = useCallback(() => {
    setStripeConnectSkipped();
    setStripeGateOpen(false);
    continueLiveStartAfterStripe();
  }, [continueLiveStartAfterStripe]);

  const proceedToMediaSetup = useCallback(() => {
    setStripeGateOpen(false);
    setLegalGateOpen(false);
    setMediaSetupOpen(true);
  }, []);

  const startLive = useCallback(() => {
    if (!token || starting) return;

    if (hasActiveSalon) {
      setStartError('Tu es déjà dans un salon. Quitte le salon pour démarrer un live.');
      return;
    }

    if (!stripeSimulation && !isStripeConnectSkipped()) {
      if (!user?.stripeConnectAccountId) {
        setStripeGatePending(false);
        setStripeGateOpen(true);
        return;
      }
      if (stripeChargesEnabled === false) {
        setStripeGatePending(true);
        setStripeGateOpen(true);
        return;
      }
    }

    if (!user?.liveTermsAcceptedAt) {
      setLegalGateOpen(true);
      return;
    }

    setMediaSetupOpen(true);
  }, [
    hasActiveSalon,
    starting,
    stripeChargesEnabled,
    stripeSimulation,
    token,
    user?.liveTermsAcceptedAt,
    user?.stripeConnectAccountId,
  ]);

  const dismissStartError = useCallback(() => setStartError(null), []);

  return {
    token,
    user,
    setUserFromProfile,
    starting,
    startError,
    dismissStartError,
    startLive,
    mediaSetupOpen,
    setMediaSetupOpen,
    mediaSetupGeneration,
    launchLiveAfterSetup,
    geo: resolvedGeo,
    stripeGateOpen,
    setStripeGateOpen,
    stripeGatePending,
    handleStripeConnectSkip,
    legalGateOpen,
    setLegalGateOpen,
    proceedToMediaSetup,
  };
}
