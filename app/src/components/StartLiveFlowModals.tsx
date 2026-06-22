import { StartLiveMediaSetupModal } from './StartLiveMediaSetupModal';
import { LiveStripeConnectGate } from './LiveStripeConnectGate';
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
    stripeGateOpen,
    setStripeGateOpen,
    stripeGatePending,
    handleStripeConnectSkip,
    legalGateOpen,
    setLegalGateOpen,
    proceedToMediaSetup,
  } = flow;

  return (
    <>
      <StartLiveMediaSetupModal
        key={mediaSetupGeneration}
        open={mediaSetupOpen}
        initialGeo={geo}
        onClose={() => setMediaSetupOpen(false)}
        onReady={() => {
          setMediaSetupOpen(false);
          void launchLiveAfterSetup();
        }}
      />

      {stripeGateOpen && token && (
        <LiveStripeConnectGate
          token={token}
          isPending={stripeGatePending}
          onClose={() => setStripeGateOpen(false)}
          onSkip={handleStripeConnectSkip}
        />
      )}

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
