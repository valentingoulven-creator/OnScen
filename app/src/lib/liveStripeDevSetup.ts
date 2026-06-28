/** Dev local : afficher l’étape Stripe Connect réelle dans le chat Lya (pas le raccourci simulation). */
export function isLiveStripeSetupPreviewMode(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_LIVE_STRIPE_SETUP_UI === '1';
}
