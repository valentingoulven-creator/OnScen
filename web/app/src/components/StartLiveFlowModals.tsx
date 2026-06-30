import { StartLiveMediaSetupModal } from './StartLiveMediaSetupModal';
import { LiveLegalAcceptanceModal } from './LiveLegalAcceptanceModal';
import type { useStartLiveFlow } from '../hooks/useStartLiveFlow';

type StartLiveFlow = ReturnType<typeof useStartLiveFlow>;

export function StartLiveFlowModals({ flow }: { flow: StartLiveFlow }) {
  const {
    token,
    user,
    setUserFromProfile,
    mediaSetupOpen,
    setMediaSetupOpen,
    mediaSetupGeneration,
    launchLiveAfterSetup,
    geo,
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
  } = flow;

  const defaultLiveTitle = user ? `Live — ${user.username}` : 'Live';
  const stripeConnectUiReady = stripeConnectReady === true;
  const donationsEnabled = (stripeSimulation || stripeConnectUiReady) && !liveTipsSkipped;
  /** Étape Lya Stripe : uniquement si le compte n’est pas déjà connecté. */
  const tipsSetupStepEnabled =
    stripeChecked && donationsPlatformEnabled && !stripeConnectUiReady;
  const stripePending =
    stripeChecked && !stripeConnectUiReady && !!user?.stripeConnectAccountId && stripeChargesEnabled === false;

  return (
    <>
      <StartLiveMediaSetupModal
        key={mediaSetupGeneration}
        open={mediaSetupOpen}
        token={token}
        initialGeo={geo}
        profileCity={user?.city}
        defaultLiveTitle={defaultLiveTitle}
        donationsEnabled={donationsEnabled}
        donationsSimulation={stripeSimulation}
        stripeStatusReady={stripeChecked}
        stripeStepRequired={false}
        tipsSetupStepEnabled={tipsSetupStepEnabled}
        stripePending={stripePending}
        stripeReady={stripeConnectUiReady}
        onStripeSkip={handleStripeConnectSkip}
        onTipsAccept={handleTipsAccepted}
        onStripeRefresh={refreshStripeStatus}
        onClose={() => setMediaSetupOpen(false)}
        onReady={() => {
          setMediaSetupOpen(false);
          void launchLiveAfterSetup();
        }}
      />

      {legalGateOpen && token && user && (
        <LiveLegalAcceptanceModal
          token={token}
          onClose={() => setLegalGateOpen(false)}
          onAccepted={(acceptedAt) => {
            setUserFromProfile({ ...user, liveTermsAcceptedAt: acceptedAt });
            proceedToMediaSetup();
          }}
        />
      )}
    </>
  );
}
