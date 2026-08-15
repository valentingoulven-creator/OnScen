import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import Stripe from 'stripe';
import { db } from '../models/schema';
import { authenticateJWT, verifyAuthToken } from '../middleware/auth';
import { getStripeClient } from '../lib/stripeClient';
import {
  DONATION_CURRENCY,
  DON_AMOUNT_MAX,
  DON_AMOUNT_MIN,
  assertDailyDonationBudget,
  assertDonAmount,
  assertCreatorCanReceiveStripeDonation,
  computeDonationFeeBreakdown,
  computeDonationPlatformFeeCents,
  getCreatorStripeConnectAccountId,
  getDonationLegalConfig,
  getDonationPlatformFeePercent,
  getDonationTiers,
  getRemainingDailyDonationBudget,
  isDonationSimulationMode,
  isDonationsEnabled,
  isStripeConfigured,
  assertCreatorCanReceiveDonation,
  assertLiveAcceptsTips,
  recordLiveDonation,
  userMeetsDonationAgeFromProfile,
} from '../lib/donations';
import { CREATOR_MONETIZATION_MIN_AGE, creatorMeetsMonetizationAgeFromProfile } from '../lib/ageGates';
import { rejectIfNativePayments } from '../lib/clientPlatform';
import { rejectIfStripeTestInProduction } from '../lib/stripeLiveGuard';
import { schedulePersist } from '../lib/persist';
import {
  donationPaymentIntentExistsInPg,
  persistDonationPaymentToPgAsync,
} from '../lib/pgDonations';

export const donationsRouter = Router();

function getStripe(): Stripe | null {
  return getStripeClient();
}

const DONATION_IDEMPOTENCY_WINDOW_MS = 60_000;

/** Clé d'idempotence déterministe : même intention utilisateur (userId+live+montant) sur une fenêtre courte -> même clé. */
function buildDonationIdempotencyKey(userId: string, liveId: string, amountCents: number): string {
  const windowBucket = Math.floor(Date.now() / DONATION_IDEMPOTENCY_WINDOW_MS);
  return crypto
    .createHash('sha256')
    .update(`donation_intent:${userId}:${liveId}:${amountCents}:${windowBucket}`)
    .digest('hex');
}

function getAppBaseUrl(): string {
  return (
    process.env.WEB_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    'http://localhost:4080'
  ).replace(/\/$/, '');
}

donationsRouter.get('/config', (req: Request, res: Response) => {
  const simulation = isDonationSimulationMode();
  const enabled = isDonationsEnabled();
  // Optionally identify the caller using any supported token source (cookie or header).
  // We use verifyAuthToken directly since this endpoint is intentionally public.
  const authHeader = req.headers.authorization;
  const cookieToken = (req as Request & { cookies?: Record<string, string> }).cookies?.['onscen_auth'];
  const rawToken =
    cookieToken ||
    (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined) ||
    (req.headers['x-auth-token'] as string | undefined);
  const decoded = rawToken ? verifyAuthToken(rawToken) : null;
  const userId = decoded?.id;

  res.json({
    enabled,
    simulation,
    stripeConfigured: isStripeConfigured(),
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY?.trim() || null,
    tiers: [...getDonationTiers()],
    minAmount: DON_AMOUNT_MIN,
    maxAmount: DON_AMOUNT_MAX,
    currency: 'EUR',
    minAge: 18,
    platformFeePercent: getDonationPlatformFeePercent(),
    legal: getDonationLegalConfig(),
    dailyCapRemaining:
      simulation && userId ? getRemainingDailyDonationBudget(userId) : null,
  });
});

// Fix #8: vérifie charges_enabled via l'API Stripe pour un statut précis
donationsRouter.get('/connect-status', authenticateJWT, async (req: Request, res: Response) => {
  const userId = (req as Request & { user: { id: string } }).user.id;
  const connectId = getCreatorStripeConnectAccountId(userId);

  if (!connectId) {
    res.json({
      stripeConfigured: isStripeConfigured(),
      stripeConnectAccountId: connectId,
      ready: false,
      chargesEnabled: false,
      detailsSubmitted: false,
    });
    return;
  }

  if (isDonationSimulationMode() && !isStripeConfigured()) {
    res.json({
      stripeConfigured: false,
      stripeConnectAccountId: connectId,
      ready: false,
      chargesEnabled: false,
      detailsSubmitted: false,
    });
    return;
  }

  const stripe = getStripe();
  if (!stripe) {
    res.json({
      stripeConfigured: false,
      stripeConnectAccountId: connectId,
      ready: false,
      chargesEnabled: false,
      detailsSubmitted: false,
    });
    return;
  }

  try {
    const account = await stripe.accounts.retrieve(connectId);
    res.json({
      stripeConfigured: isStripeConfigured(),
      stripeConnectAccountId: connectId,
      ready: account.charges_enabled === true,
      chargesEnabled: account.charges_enabled,
      detailsSubmitted: account.details_submitted,
    });
  } catch {
    // Retourner les données connues sans bloquer si Stripe est indisponible
    res.json({
      stripeConfigured: isStripeConfigured(),
      stripeConnectAccountId: connectId,
      ready: Boolean(connectId),
      chargesEnabled: null,
      detailsSubmitted: null,
      error: 'Impossible de vérifier le statut du compte Stripe',
    });
  }
});

donationsRouter.post('/connect-onboard', authenticateJWT, async (req: Request, res: Response) => {
  if (rejectIfNativePayments(req, res)) return;
  if (rejectIfStripeTestInProduction(res)) return;
  if (isDonationSimulationMode() && !isStripeConfigured()) {
    res.status(400).json({
      error: 'Stripe Connect en dev : ajoute STRIPE_SECRET_KEY et STRIPE_PUBLISHABLE_KEY dans commun/msdev/.env',
    });
    return;
  }
  if (!isStripeConfigured()) {
    res.status(503).json({ error: 'Stripe non configuré' });
    return;
  }

  const stripe = getStripe();
  if (!stripe) {
    res.status(503).json({ error: 'Stripe non configuré' });
    return;
  }

  const userId = (req as Request & { user: { id: string } }).user.id;
  const user = db.users.get(userId);
  if (!user) {
    res.status(404).json({ error: 'Utilisateur introuvable' });
    return;
  }
  if (!creatorMeetsMonetizationAgeFromProfile(user)) {
    res.status(403).json({
      error: `Monétisation disponible à partir de ${CREATOR_MONETIZATION_MIN_AGE} ans.`,
      code: 'CREATOR_MONETIZATION_AGE_REQUIRED',
    });
    return;
  }

  let connectId = getCreatorStripeConnectAccountId(userId);
  try {
    if (!connectId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'FR',
        email: user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: { onscenUserId: userId },
      });
      connectId = account.id;
      user.stripeConnectAccountId = connectId;
      db.users.set(userId, user);
      schedulePersist();
    }

    const link = await stripe.accountLinks.create({
      account: connectId,
      refresh_url: `${getAppBaseUrl()}/profile?stripeConnect=refresh`,
      return_url: `${getAppBaseUrl()}/profile?stripeConnect=return`,
      type: 'account_onboarding',
    });

    res.json({ url: link.url, stripeConnectAccountId: connectId });
  } catch (e) {
    // Ne jamais renvoyer le message brut de l'API Stripe au client (peut exposer
    // des détails de compte/config) — on le garde côté logs serveur uniquement.
    console.error('[donations] connect-onboard error', e instanceof Error ? e.message : e);
    res.status(502).json({ error: "Impossible d'initialiser Stripe Connect pour le moment." });
  }
});

donationsRouter.post('/simulate', authenticateJWT, (req: Request, res: Response) => {
  if (!isDonationSimulationMode()) {
    res.status(403).json({ error: 'Simulation réservée au mode msdev' });
    return;
  }
  if (!isDonationsEnabled()) {
    res.status(503).json({ error: 'Dons désactivés' });
    return;
  }

  const userId = (req as Request & { user: { id: string } }).user.id;
  const user = db.users.get(userId);
  const { liveId, amount: rawAmount, ageConfirmed } = req.body;

  if (!user || !liveId) {
    res.status(400).json({ error: 'Paramètres invalides' });
    return;
  }

  if (!userMeetsDonationAgeFromProfile(user)) {
    res.status(403).json({
      error: 'Vous devez avoir 18 ans ou plus pour effectuer un don (date de naissance requise sur votre profil).',
      code: 'DONATION_AGE_REQUIRED',
    });
    return;
  }

  const live = db.lives.get(liveId);
  if (!live?.isActive) {
    res.status(404).json({ error: 'Live introuvable' });
    return;
  }

  try {
    assertCreatorCanReceiveDonation(live.hostId);
    assertLiveAcceptsTips(live);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Don impossible';
    const code = message.includes('désactivés')
      ? 'LIVE_TIPS_DISABLED'
      : 'CREATOR_MONETIZATION_AGE_REQUIRED';
    res.status(403).json({
      error: message.includes('désactivés')
        ? message
        : message || `Monétisation disponible à partir de ${CREATOR_MONETIZATION_MIN_AGE} ans.`,
      code,
    });
    return;
  }

  const amount = Math.trunc(Number(rawAmount));
  try {
    assertDonAmount(amount);
    assertDailyDonationBudget(userId, amount);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Montant invalide' });
    return;
  }

  try {
    const gift = recordLiveDonation({
      liveId,
      senderId: userId,
      senderName: user.username,
      senderAvatarUrl: user.avatarUrl,
      amount,
      paymentMode: 'simulation',
    });
    res.status(201).json({
      gift,
      simulation: true,
      message: `Simulation — merci pour votre soutien symbolique de ${amount} €`,
    });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Erreur' });
  }
});

donationsRouter.post('/create-intent', authenticateJWT, async (req: Request, res: Response) => {
  if (rejectIfNativePayments(req, res)) return;
  if (rejectIfStripeTestInProduction(res)) return;
  if (isDonationSimulationMode()) {
    res.status(400).json({ error: 'Utilisez la simulation en mode msdev' });
    return;
  }
  if (!isDonationsEnabled()) {
    res.status(503).json({ error: 'Dons désactivés' });
    return;
  }

  const stripe = getStripe();
  if (!stripe) {
    res.status(503).json({ error: 'Paiement non configuré' });
    return;
  }

  const userId = (req as Request & { user: { id: string } }).user.id;
  const user = db.users.get(userId);
  const { liveId, amount: rawAmount, ageConfirmed } = req.body;

  if (!user || !liveId) {
    res.status(400).json({ error: 'Paramètres invalides' });
    return;
  }

  if (!userMeetsDonationAgeFromProfile(user)) {
    res.status(403).json({
      error: 'Vous devez avoir 18 ans ou plus pour effectuer un don (date de naissance requise sur votre profil).',
      code: 'DONATION_AGE_REQUIRED',
    });
    return;
  }
  if (ageConfirmed !== true) {
    res.status(400).json({
      error: 'Confirmation d’âge requise.',
      code: 'AGE_CONFIRMATION_REQUIRED',
    });
    return;
  }

  const live = db.lives.get(liveId);
  if (!live?.isActive) {
    res.status(404).json({ error: 'Live introuvable' });
    return;
  }

  try {
    assertCreatorCanReceiveDonation(live.hostId);
    assertLiveAcceptsTips(live);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Don impossible';
    const code = message.includes('désactivés')
      ? 'LIVE_TIPS_DISABLED'
      : 'CREATOR_MONETIZATION_AGE_REQUIRED';
    res.status(403).json({
      error: message.includes('désactivés')
        ? message
        : message || `Monétisation disponible à partir de ${CREATOR_MONETIZATION_MIN_AGE} ans.`,
      code,
    });
    return;
  }

  const amount = Math.trunc(Number(rawAmount));
  try {
    assertDonAmount(amount);
    assertCreatorCanReceiveStripeDonation(live.hostId);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Montant invalide';
    const code =
      message.includes('Stripe Connect') ? 'CREATOR_STRIPE_CONNECT_REQUIRED' : undefined;
    res.status(code ? 503 : 400).json({ error: message, code });
    return;
  }

  const amountCents = amount * 100;
  const platformFeeCents = computeDonationPlatformFeeCents(amountCents);
  const connectAccountId = getCreatorStripeConnectAccountId(live.hostId);
  const feeBreakdown = computeDonationFeeBreakdown(amount);

  // Verify Connect account is fully onboarded (charges_enabled) before creating the PaymentIntent.
  // Simulation mode is already blocked at the top of this route.
  try {
    const account = await stripe.accounts.retrieve(connectAccountId!);
    if (!account.charges_enabled) {
      res.status(400).json({
        error: 'Le créateur n\'a pas encore finalisé son compte de paiement.',
        code: 'CREATOR_CHARGES_NOT_ENABLED',
      });
      return;
    }
  } catch (e) {
    if (e instanceof Stripe.errors.StripeError) {
      res.status(503).json({ error: 'Impossible de vérifier le compte de paiement du créateur.' });
      return;
    }
    throw e;
  }

  try {
    const idempotencyKey = buildDonationIdempotencyKey(userId, liveId, amountCents);
    const intent = await stripe.paymentIntents.create(
      {
        amount: amountCents,
        currency: DONATION_CURRENCY,
        automatic_payment_methods: { enabled: true },
        application_fee_amount: platformFeeCents,
        transfer_data: {
          destination: connectAccountId!,
        },
        metadata: {
          liveId,
          senderId: userId,
          hostId: live.hostId,
          type: 'live_tip',
          platformFeePercent: String(getDonationPlatformFeePercent()),
          platformFeeCents: String(platformFeeCents),
        },
        description: `Pourboire live — ${live.title}`.slice(0, 200),
      },
      { idempotencyKey }
    );

    db.donationPayments.push({
      id: `dp_${Date.now()}`,
      paymentIntentId: intent.id,
      liveId,
      senderId: userId,
      hostId: live.hostId,
      amountCents,
      platformFeeCents,
      status: 'pending',
      createdAt: Date.now(),
    });
    const pendingPayment = db.donationPayments[db.donationPayments.length - 1];
    persistDonationPaymentToPgAsync(pendingPayment);

    res.status(201).json({
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      amount,
      currency: 'EUR',
      platformFeePercent: feeBreakdown.platformFeePercent,
      platformFeeEur: feeBreakdown.platformFeeEur,
      creatorNetEstimateEur: feeBreakdown.creatorNetEstimateEur,
    });
  } catch (e) {
    const stripeCardMessages: Record<string, string> = {
      card_declined: 'Carte refusée. Vérifiez vos informations ou contactez votre banque.',
      insufficient_funds: 'Fonds insuffisants sur votre carte.',
      invalid_cvc: 'Code de sécurité (CVC) invalide.',
      expired_card: 'Carte expirée. Veuillez utiliser une autre carte.',
    };
    if (e instanceof Stripe.errors.StripeCardError) {
      const msg = (e.code && stripeCardMessages[e.code]) || 'Paiement refusé par votre banque.';
      res.status(402).json({ error: msg, stripeCode: e.code });
      return;
    }
    console.error('[donations] create-intent error');
    res.status(502).json({ error: 'Impossible de préparer le paiement' });
  }
});

/** Webhook Stripe — monté avec express.raw() dans server.ts */
export async function handleStripeDonationWebhook(req: Request, res: Response): Promise<void> {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

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

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object as Stripe.PaymentIntent;
    const liveId = intent.metadata?.liveId;
    const senderId = intent.metadata?.senderId;
    const amountCents = intent.amount_received ?? intent.amount;

    if (!liveId || !senderId || !amountCents) {
      res.json({ received: true });
      return;
    }

    const sender = db.users.get(senderId);
    if (!sender) {
      res.json({ received: true });
      return;
    }

    const existing = db.gifts.find((g) => g.paymentIntentId === intent.id);
    if (!existing) {
      // Le state db.gifts est en mémoire par process PM2 ; un retry Stripe peut
      // atterrir sur un autre worker qui ne connaît pas encore ce paiement.
      // On vérifie donc aussi en base (contrainte UNIQUE sur payment_intent_id)
      // avant de créditer, pour éviter un double crédit en environnement cluster.
      let alreadyCreditedInPg = false;
      try {
        alreadyCreditedInPg = await donationPaymentIntentExistsInPg(intent.id);
      } catch (err) {
        console.error('[donations] webhook pg dedup check error:', err);
      }

      if (!alreadyCreditedInPg) {
        try {
          recordLiveDonation({
            liveId,
            senderId,
            senderName: sender.username,
            senderAvatarUrl: sender.avatarUrl,
            amount: Math.round(amountCents / 100),
            paymentMode: 'stripe',
            paymentIntentId: intent.id,
          });
        } catch {
          console.error('[donations] webhook credit error');
        }
      }
    }

    const payment = db.donationPayments?.find((p) => p.paymentIntentId === intent.id);
    if (payment) {
      payment.status = 'succeeded';
      persistDonationPaymentToPgAsync(payment);
    }
  }

  res.json({ received: true });
}
