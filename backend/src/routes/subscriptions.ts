import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import Stripe from 'stripe';
import { db } from '../models/schema';
import { authenticateJWT } from '../middleware/auth';
import { getJwtSecret } from '../lib/jwtSecret';
import {
  PLATFORM_CREATOR_ID,
  assertCreatorCanReceiveSubscription,
  assertDailySimulationSubBudget,
  cancelSubscriptionRecord,
  getActiveSubscription,
  getCreatorSubscriberCount,
  getPlatformCommissionPercent,
  getRemainingDailySimulationSubBudget,
  getSubscriptionTiers,
  getTierById,
  isSubscriptionSimulationMode,
  isSubscriptionsEnabled,
  isSupporter,
  recordCreatorSubscription,
  renewSubscriptionFromInvoice,
  resolveCreatorId,
  userMeetsSubscriptionAge,
  type SubscriptionTargetType,
} from '../lib/subscriptions';
import { isStripeConfigured } from '../lib/donations';
import {
  getPlatformPlanStatus,
  listPlatformPlans,
} from '../lib/platformPlans';
import { CREATOR_MONETIZATION_MIN_AGE } from '../lib/ageGates';

export const subscriptionsRouter = Router();

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  return new Stripe(key);
}

function getAppBaseUrl(): string {
  return (
    process.env.WEB_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    'http://localhost:4080'
  ).replace(/\/$/, '');
}

subscriptionsRouter.get('/config', (req: Request, res: Response) => {
  const simulation = isSubscriptionSimulationMode();
  const enabled = isSubscriptionsEnabled();
  const authHeader = req.headers.authorization;
  let userId: string | undefined;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.slice(7), getJwtSecret()) as { id: string };
      userId = decoded.id;
    } catch {
      /* config publique */
    }
  }

  res.json({
    enabled,
    simulation,
    stripeConfigured: isStripeConfigured(),
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY?.trim() || null,
    tiers: getSubscriptionTiers().map((t) => ({
      id: t.id,
      label: t.label,
      amountCents: t.amountCents,
      amountEur: t.amountCents / 100,
      targetType: t.targetType,
      stripeConfigured: Boolean(t.stripePriceId),
    })),
    currency: 'EUR',
    minAge: 18,
    platformCommissionPercent: getPlatformCommissionPercent(),
    dailyCapRemaining:
      simulation && userId ? getRemainingDailySimulationSubBudget(userId) : null,
    platformPlans: listPlatformPlans().map((p) => ({
      id: p.id,
      label: p.label,
      priceCents: p.priceCents,
      priceDisplay: p.priceDisplay,
      subscriptionTierId: p.subscriptionTierId,
      limits: p.limits,
      featuresFr: p.featuresFr,
    })),
  });
});

subscriptionsRouter.get('/platform-plan', authenticateJWT, (req: Request, res: Response) => {
  const userId = (req as Request & { user: { id: string } }).user.id;
  const status = getPlatformPlanStatus(userId);
  res.json({
    ...status,
    plans: listPlatformPlans().map((p) => ({
      id: p.id,
      label: p.label,
      priceCents: p.priceCents,
      priceDisplay: p.priceDisplay,
      subscriptionTierId: p.subscriptionTierId,
      limits: p.limits,
      featuresFr: p.featuresFr,
    })),
  });
});

subscriptionsRouter.get('/status', authenticateJWT, (req: Request, res: Response) => {
  const userId = (req as Request & { user: { id: string } }).user.id;
  const creatorId = String(req.query.creatorId ?? '');
  const targetType = (req.query.targetType as SubscriptionTargetType) || 'creator';

  let resolvedCreatorId: string;
  try {
    resolvedCreatorId = resolveCreatorId(targetType, creatorId);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Paramètres invalides' });
    return;
  }

  const active = getActiveSubscription(userId, resolvedCreatorId);
  res.json({
    isSupporter: active != null,
    subscription: active,
    subscriberCount:
      resolvedCreatorId !== PLATFORM_CREATOR_ID
        ? getCreatorSubscriberCount(resolvedCreatorId)
        : undefined,
  });
});

subscriptionsRouter.post('/simulate', authenticateJWT, (req: Request, res: Response) => {
  if (!isSubscriptionSimulationMode()) {
    res.status(403).json({ error: 'Simulation réservée au mode msdev' });
    return;
  }
  if (!isSubscriptionsEnabled()) {
    res.status(503).json({ error: 'Abonnements désactivés' });
    return;
  }

  const userId = (req as Request & { user: { id: string } }).user.id;
  const user = db.users.get(userId);
  const { creatorId, tierId, targetType = 'creator', ageConfirmed } = req.body as {
    creatorId?: string;
    tierId?: string;
    targetType?: SubscriptionTargetType;
    ageConfirmed?: boolean;
  };

  if (!user || !tierId) {
    res.status(400).json({ error: 'Paramètres invalides' });
    return;
  }

  if (!ageConfirmed && !userMeetsSubscriptionAge(user.age)) {
    res.status(403).json({
      error: 'Vous devez avoir 18 ans ou plus pour vous abonner',
      code: 'SUBSCRIPTION_AGE_REQUIRED',
    });
    return;
  }

  let resolvedCreatorId: string;
  try {
    resolvedCreatorId = resolveCreatorId(targetType, creatorId);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Créateur requis' });
    return;
  }

  if (resolvedCreatorId === userId) {
    res.status(400).json({ error: 'Vous ne pouvez pas vous abonner à vous-même' });
    return;
  }

  try {
    assertCreatorCanReceiveSubscription(resolvedCreatorId);
  } catch (e) {
    res.status(403).json({
      error: e instanceof Error ? e.message : `Monétisation disponible à partir de ${CREATOR_MONETIZATION_MIN_AGE} ans.`,
      code: 'CREATOR_MONETIZATION_AGE_REQUIRED',
    });
    return;
  }

  const tier = getTierById(tierId, targetType);
  if (!tier) {
    res.status(400).json({ error: 'Palier invalide' });
    return;
  }

  try {
    assertDailySimulationSubBudget(userId);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Plafond atteint' });
    return;
  }

  try {
    const sub = recordCreatorSubscription({
      subscriberId: userId,
      creatorId: resolvedCreatorId,
      tierId: tier.id,
      tierLabel: tier.label,
      amountCents: tier.amountCents,
      targetType,
      paymentMode: 'simulation',
    });
    res.status(201).json({
      subscription: sub,
      simulation: true,
      message: `Simulation — abonnement ${tier.label} activé (aucun paiement réel)`,
    });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Erreur' });
  }
});

subscriptionsRouter.post('/create-checkout', authenticateJWT, async (req: Request, res: Response) => {
  if (isSubscriptionSimulationMode()) {
    res.status(400).json({ error: 'Utilisez la simulation en mode msdev' });
    return;
  }
  if (!isSubscriptionsEnabled()) {
    res.status(503).json({ error: 'Abonnements désactivés' });
    return;
  }

  const stripe = getStripe();
  if (!stripe) {
    res.status(503).json({ error: 'Paiement non configuré' });
    return;
  }

  const userId = (req as Request & { user: { id: string } }).user.id;
  const user = db.users.get(userId);
  const { creatorId, tierId, targetType = 'creator', ageConfirmed } = req.body as {
    creatorId?: string;
    tierId?: string;
    targetType?: SubscriptionTargetType;
    ageConfirmed?: boolean;
  };

  if (!user || !tierId) {
    res.status(400).json({ error: 'Paramètres invalides' });
    return;
  }

  if (!ageConfirmed && !userMeetsSubscriptionAge(user.age)) {
    res.status(403).json({
      error: 'Vous devez avoir 18 ans ou plus pour vous abonner',
      code: 'SUBSCRIPTION_AGE_REQUIRED',
    });
    return;
  }

  let resolvedCreatorId: string;
  try {
    resolvedCreatorId = resolveCreatorId(targetType, creatorId);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Créateur requis' });
    return;
  }

  if (resolvedCreatorId === userId) {
    res.status(400).json({ error: 'Vous ne pouvez pas vous abonner à vous-même' });
    return;
  }

  try {
    assertCreatorCanReceiveSubscription(resolvedCreatorId);
  } catch (e) {
    res.status(403).json({
      error: e instanceof Error ? e.message : `Monétisation disponible à partir de ${CREATOR_MONETIZATION_MIN_AGE} ans.`,
      code: 'CREATOR_MONETIZATION_AGE_REQUIRED',
    });
    return;
  }

  const tier = getTierById(tierId, targetType);
  if (!tier?.stripePriceId) {
    res.status(503).json({ error: 'Palier non configuré (STRIPE_PRICE_ID manquant)' });
    return;
  }

  const baseUrl = getAppBaseUrl();

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: user.email,
      line_items: [{ price: tier.stripePriceId, quantity: 1 }],
      success_url: `${baseUrl}/?subscribe=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/?subscribe=cancel`,
      metadata: {
        subscriberId: userId,
        creatorId: resolvedCreatorId,
        tierId: tier.id,
        tierLabel: tier.label,
        targetType,
        type: 'creator_subscription',
      },
      subscription_data: {
        metadata: {
          subscriberId: userId,
          creatorId: resolvedCreatorId,
          tierId: tier.id,
          tierLabel: tier.label,
          targetType,
        },
      },
    });

    db.subscriptionCheckouts.push({
      id: `sc_${Date.now()}`,
      sessionId: session.id,
      subscriberId: userId,
      creatorId: resolvedCreatorId,
      tierId: tier.id,
      targetType,
      status: 'pending',
      createdAt: Date.now(),
    });

    res.status(201).json({
      checkoutUrl: session.url,
      sessionId: session.id,
    });
  } catch {
    console.error('[subscriptions] create-checkout error');
    res.status(502).json({ error: 'Impossible de préparer l’abonnement' });
  }
});

subscriptionsRouter.post('/create-portal', authenticateJWT, async (req: Request, res: Response) => {
  if (isSubscriptionSimulationMode()) {
    res.status(400).json({ error: 'Portail Stripe indisponible en simulation' });
    return;
  }

  const stripe = getStripe();
  if (!stripe) {
    res.status(503).json({ error: 'Paiement non configuré' });
    return;
  }

  const userId = (req as Request & { user: { id: string } }).user.id;
  const { creatorId, targetType = 'creator' } = req.body as {
    creatorId?: string;
    targetType?: SubscriptionTargetType;
  };

  let resolvedCreatorId: string;
  try {
    resolvedCreatorId = resolveCreatorId(targetType, creatorId);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Paramètres invalides' });
    return;
  }

  const active = getActiveSubscription(userId, resolvedCreatorId);
  if (!active?.stripeCustomerId) {
    res.status(404).json({ error: 'Aucun abonnement Stripe actif' });
    return;
  }

  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer: active.stripeCustomerId,
      return_url: `${getAppBaseUrl()}/`,
    });
    res.json({ portalUrl: portal.url });
  } catch {
    res.status(502).json({ error: 'Impossible d’ouvrir le portail de gestion' });
  }
});

/** Webhook Stripe — monté avec express.raw() dans server.ts */
export async function handleStripeSubscriptionWebhook(req: Request, res: Response): Promise<void> {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET?.trim()
    || process.env.STRIPE_WEBHOOK_SECRET?.trim();

  if (!stripe || !webhookSecret) {
    res.status(503).send('Webhook non configuré');
    return;
  }

  const signature = req.headers['stripe-signature'];
  if (!signature || typeof signature !== 'string') {
    res.status(400).send('Signature manquante');
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch {
    res.status(400).send('Signature invalide');
    return;
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode !== 'subscription' || session.metadata?.type !== 'creator_subscription') {
      res.json({ received: true });
      return;
    }

    const subscriberId = session.metadata.subscriberId;
    const creatorId = session.metadata.creatorId;
    const tierId = session.metadata.tierId;
    const tierLabel = session.metadata.tierLabel || tierId;
    const targetType = (session.metadata.targetType as SubscriptionTargetType) || 'creator';
    const stripeSubId =
      typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
    const stripeCustomerId =
      typeof session.customer === 'string' ? session.customer : session.customer?.id;

    if (!subscriberId || !creatorId || !tierId || !stripeSubId) {
      res.json({ received: true });
      return;
    }

    const tier = getTierById(tierId, targetType);
    const amountCents = tier?.amountCents ?? 0;

    let periodEnd = Date.now() + 30 * 24 * 60 * 60 * 1000;
    try {
      const stripeSub = await stripe.subscriptions.retrieve(stripeSubId);
      periodEnd = (stripeSub.current_period_end ?? 0) * 1000 || periodEnd;
    } catch {
      /* fallback period */
    }

    recordCreatorSubscription({
      subscriberId,
      creatorId,
      tierId,
      tierLabel,
      amountCents,
      targetType,
      paymentMode: 'stripe',
      stripeSubscriptionId: stripeSubId,
      stripeCustomerId,
      currentPeriodEnd: periodEnd,
    });

    const checkout = db.subscriptionCheckouts.find((c) => c.sessionId === session.id);
    if (checkout) checkout.status = 'completed';
  }

  if (event.type === 'invoice.paid') {
    const invoice = event.data.object as Stripe.Invoice;
    const stripeSubId =
      typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
    if (stripeSubId) {
      try {
        const stripeSub = await stripe.subscriptions.retrieve(stripeSubId);
        const periodEnd = (stripeSub.current_period_end ?? 0) * 1000;
        if (periodEnd) renewSubscriptionFromInvoice(stripeSubId, periodEnd);
      } catch (e) {
        console.error('[subscriptions] invoice.paid webhook renewal failed:', stripeSubId, e);
      }
    }
  }

  if (
    event.type === 'customer.subscription.deleted' ||
    event.type === 'customer.subscription.updated'
  ) {
    const sub = event.data.object as Stripe.Subscription;
    const stripeSubId = sub.id;
    if (sub.status === 'active' || sub.status === 'trialing') {
      const periodEnd = (sub.current_period_end ?? 0) * 1000;
      if (periodEnd) renewSubscriptionFromInvoice(stripeSubId, periodEnd);
    } else if (sub.status === 'canceled' || sub.status === 'unpaid') {
      cancelSubscriptionRecord(stripeSubId, sub.status === 'unpaid' ? 'past_due' : 'canceled');
    }
  }

  res.json({ received: true });
}

/** Utilitaire profil public */
export function getViewerSupporterInfo(viewerId: string | undefined, creatorId: string) {
  if (!viewerId || viewerId === creatorId) {
    return { isSupporter: false, subscriberCount: getCreatorSubscriberCount(creatorId) };
  }
  return {
    isSupporter: isSupporter(viewerId, creatorId),
    subscriberCount: getCreatorSubscriberCount(creatorId),
  };
}
