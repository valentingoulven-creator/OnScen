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
import { setStripeConnectSkipped, clearStripeConnectSkipped } from '../lib/stripeConnectSkip';
import { isLiveStripeSetupPreviewMode } from '../lib/liveStripeDevSetup';

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
  const { token, user, setUserFromProfile, refreshUser } = useAuth();
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [mediaSetupOpen, setMediaSetupOpen] = useState(false);
  const [mediaSetupGeneration, setMediaSetupGeneration] = useState(0);
  const [legalGateOpen, setLegalGateOpen] = useState(false);
  const [geo, setGeo] = useState<LivesGeoPrefs>(() => initialGeo ?? getLivesGeo());

  const [stripeChecked, setStripeChecked] = useState(false);
  const [stripeSimulation, setStripeSimulation] = useState(false);
  const [donationsPlatformEnabled, setDonationsPlatformEnabled] = useState(false);
  const [stripeConnectReady, setStripeConnectReady] = useState(false);
  const [stripeChargesEnabled, setStripeChargesEnabled] = useState<boolean | null>(null);
  /** Choix explicite « live sans pourboires » dans le setup Lya (session courante). */
  const [liveTipsSkipped, setLiveTipsSkipped] = useState(false);

  const resolvedGeo = useMemo(
    () => initialGeo ?? geo,
    [geo, initialGeo]
  );

  useEffect(() => {
    if (initialGeo) setGeo(initialGeo);
  }, [initialGeo?.latitude, initialGeo?.longitude, initialGeo?.label, initialGeo?.source]);

  const verifyStripeForLiveSetup = useCallback(async () => {
    if (!token) return;
    setStripeChecked(false);
    try {
      const config = await api.getDonationsConfig(token);
      setStripeSimulation(config.simulation ?? false);
      setDonationsPlatformEnabled(config.enabled === true);
      const previewStripeSetup = isLiveStripeSetupPreviewMode();
      if (config.simulation && !previewStripeSetup) {
        setStripeConnectReady(true);
        setStripeChargesEnabled(true);
        return;
      }
      if (config.simulation && previewStripeSetup && !config.stripeConfigured) {
        setStripeConnectReady(false);
        setStripeChargesEnabled(null);
        return;
      }
      const status = await api.getStripeConnectStatus(token);
      setStripeConnectReady(status.ready === true);
      setStripeChargesEnabled(status.chargesEnabled ?? null);
      await refreshUser();
    } catch {
      setStripeConnectReady(false);
      setStripeChargesEnabled(null);
    } finally {
      setStripeChecked(true);
    }
  }, [refreshUser, token]);

  useEffect(() => {
    if (!isActive || !token) return;
    void verifyStripeForLiveSetup();
  }, [isActive, token, mediaSetupOpen, verifyStripeForLiveSetup]);

  useEffect(() => {
    const syncGeo = () => setGeo(getLivesGeo());
    window.addEventListener(MAP_GEO_CHANGED_EVENT, syncGeo);
    return () => window.removeEventListener(MAP_GEO_CHANGED_EVENT, syncGeo);
  }, []);

  const launchLiveAfterSetup = useCallback(async () => {
    // Garde anti double-soumission : un double-tap sur « Prêt » avant que la modale
    // ne se démonte peut déclencher onReady() deux fois → deux POST /lives/start concurrents.
    if (!token || starting) return;
    setStarting(true);
    try {
      const prefs = getLiveMediaPrefs() ?? getLiveMediaDraft();
      const lat = prefs?.startLatitude ?? resolvedGeo.latitude;
      const lon = prefs?.startLongitude ?? resolvedGeo.longitude;
      const skipped = liveTipsSkipped;
      const title =
        prefs?.liveTitle?.trim() || `Live — ${user?.username ?? 'Live'}`;
      const { live } = await api.startLive(token, title, {
        latitude: lat,
        longitude: lon,
        stripeConnectSkipped: skipped || undefined,
        useObs: prefs?.useObs || undefined,
        contentCategory: prefs?.contentCategory,
      });
      clearLiveMediaDraft();
      setMediaSetupGeneration((g) => g + 1);
      onOpenLive(live.id);
    } catch (e) {
      setStartError(e instanceof Error ? e.message : 'Impossible de démarrer le live');
    } finally {
      setStarting(false);
    }
  }, [liveTipsSkipped, onOpenLive, resolvedGeo.latitude, resolvedGeo.longitude, starting, token, user?.username]);

  const proceedToMediaSetup = useCallback(() => {
    setLegalGateOpen(false);
    setMediaSetupOpen(true);
  }, []);

  const refreshStripeStatus = useCallback(async () => {
    await verifyStripeForLiveSetup();
  }, [verifyStripeForLiveSetup]);

  const handleStripeConnectSkip = useCallback(() => {
    setLiveTipsSkipped(true);
    setStripeConnectSkipped();
  }, []);

  const handleTipsAccepted = useCallback(() => {
    setLiveTipsSkipped(false);
    clearStripeConnectSkipped();
  }, []);

  const startLive = useCallback(() => {
    if (!token || starting) return;

    if (hasActiveSalon) {
      setStartError('Tu es déjà dans un salon. Quitte le salon pour démarrer un live.');
      return;
    }

    if (!user?.liveTermsAcceptedAt) {
      setLegalGateOpen(true);
      return;
    }

    setLiveTipsSkipped(false);
    clearStripeConnectSkipped();
    setMediaSetupOpen(true);
  }, [hasActiveSalon, starting, token, user?.liveTermsAcceptedAt]);

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
    handleStripeConnectSkip,
    handleTipsAccepted,
    liveTipsSkipped,
    refreshStripeStatus,
    legalGateOpen,
    setLegalGateOpen,
    proceedToMediaSetup,
    stripeSimulation,
    donationsPlatformEnabled,
    stripeConnectReady,
    stripeChargesEnabled,
    stripeChecked,
  };
}
