import { db } from '../models/schema';
import { isStripeTestMode } from './stripeConfig';
import { getStripeClient } from './stripeClient';

/** Annule les abonnements Stripe actifs liés à l'utilisateur (subscriber ou creator Connect). */
export async function cancelStripeSubscriptionsForUser(userId: string): Promise<void> {
  const stripe = getStripeClient();
  if (!stripe) return;

  const subs = db.creatorSubscriptions.filter(
    (s) =>
      (s.subscriberId === userId || s.creatorId === userId) &&
      s.status === 'active' &&
      s.paymentMode === 'stripe' &&
      s.stripeSubscriptionId
  );

  for (const sub of subs) {
    const stripeSubId = sub.stripeSubscriptionId!;
    try {
      await stripe.subscriptions.cancel(stripeSubId);
      sub.status = 'canceled';
      sub.updatedAt = Date.now();
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code !== 'resource_missing') {
        console.warn(`[accountDeletion] Stripe cancel ${stripeSubId}:`, err);
      } else {
        sub.status = 'canceled';
        sub.updatedAt = Date.now();
      }
    }
  }

  if (isStripeTestMode()) {
    /* test mode — no extra logging */
  }
}
