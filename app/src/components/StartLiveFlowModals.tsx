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
    refreshStripeStatus,
    legalGateOpen,
    setLegalGateOpen,
    proceedToMediaSetup,
    stripeSimulation,
    stripeConnectReady,
    stripeChargesEnabled,
    stripeChecked,
  } = flow;

  const defaultLiveTitle = user ? `Live — ${user.username}` : 'Live';
  const stripeReady = stripeSimulation || stripeConnectReady === true;
  const donationsEnabled = stripeReady;
  /** Étape chat Lya : uniquement si Stripe pas encore prêt (pas le bypass dev de lancement). */
  const stripeStepRequired = stripeChecked && !stripeSimulation && !stripeReady;
  const stripePending =
    stripeChecked && !stripeReady && !!user?.stripeConnectAccountId && stripeChargesEnabled === false;

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
        stripeStepRequired={stripeStepRequired}
        stripePending={stripePending}
        stripeReady={stripeReady}
        onStripeSkip={handleStripeConnectSkip}
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
