import type { LivesGeoPrefs } from '../lib/livesGeo';
import type { LiveMediaPrefs } from '../lib/liveMediaPrefs';

export interface StartLiveMediaSetupModalProps {
  open: boolean;
  onClose: () => void;
  onReady: (prefs: LiveMediaPrefs) => void;
  confirmLabel?: string;
  defaultLiveTitle?: string;
  donationsEnabled?: boolean;
  donationsSimulation?: boolean;
  initialGeo?: LivesGeoPrefs;
  token?: string | null;
  profileCity?: string;
  /** Statut Stripe vérifié (évite flash titre avant check API). */
  stripeStatusReady?: boolean;
  stripeStepRequired?: boolean;
  /** Afficher l'étape Lya pour choisir comment recevoir les pourboires. */
  tipsSetupStepEnabled?: boolean;
  stripePending?: boolean;
  stripeReady?: boolean;
  onStripeSkip?: () => void;
  /** L'hôte a choisi de recevoir des pourboires (RIB ou simulation). */
  onTipsAccept?: () => void;
  onStripeRefresh?: () => void | Promise<void>;
}
