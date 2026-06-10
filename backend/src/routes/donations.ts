import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import Stripe from 'stripe';
import { db } from '../models/schema';
import { authenticateJWT } from '../middleware/auth';
import {
  DONATION_CURRENCY,
  DON_AMOUNT_MAX,
  DON_AMOUNT_MIN,
  assertDailyDonationBudget,
  assertDonAmount,
  getDonationTiers,
  getRemainingDailyDonationBudget,
  isDonationSimulationMode,
  isDonationsEnabled,
  isStripeConfigured,
  assertCreatorCanReceiveDonation,
  recordLiveDonation,
  userMeetsDonationAge,
} from '../lib/donations';
import { CREATOR_MONETIZATION_MIN_AGE } from '../lib/ageGates';

export const donationsRouter = Router();

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  return new Stripe(key);
}

donationsRouter.get('/config', (req: Request, res: Response) => {
  const simulation = isDonationSimulationMode();
  const enabled = isDonationsEnabled();
  const authHeader = req.headers.authorization;
  let userId: string | undefined;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const secret = process.env.JWT_SECRET || 'melosong_dev_secret';
      const decoded = jwt.verify(authHeader.slice(7), secret) as { id: string };
      userId = decoded.id;
    } catch {
      /* config publique sans plafond perso */
    }
  }

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
    dailyCapRemaining:
      simulation && userId ? getRemainingDailyDonationBudget(userId) : null,
  });
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

  if (!ageConfirmed && !userMeetsDonationAge(user.age)) {
    res.status(403).json({
      error: 'Vous devez avoir 18 ans ou plus pour effectuer un don',
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
  } catch (e) {
    res.status(403).json({
      error: e instanceof Error ? e.message : `Monétisation disponible à partir de ${CREATOR_MONETIZATION_MIN_AGE} ans.`,
      code: 'CREATOR_MONETIZATION_AGE_REQUIRED',
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

  if (!ageConfirmed && !userMeetsDonationAge(user.age)) {
    res.status(403).json({
      error: 'Vous devez avoir 18 ans ou plus pour effectuer un don',
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
  } catch (e) {
    res.status(403).json({
      error: e instanceof Error ? e.message : `Monétisation disponible à partir de ${CREATOR_MONETIZATION_MIN_AGE} ans.`,
      code: 'CREATOR_MONETIZATION_AGE_REQUIRED',
    });
    return;
  }

  const amount = Math.trunc(Number(rawAmount));
  try {
    assertDonAmount(amount);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Montant invalide' });
    return;
  }

  const amountCents = amount * 100;

  try {
    const intent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: DONATION_CURRENCY,
      automatic_payment_methods: { enabled: true },
      metadata: {
        liveId,
        senderId: userId,
        hostId: live.hostId,
        type: 'live_tip',
      },
      description: `Pourboire live — ${live.title}`.slice(0, 200),
    });

    db.donationPayments.push({
      id: `dp_${Date.now()}`,
      paymentIntentId: intent.id,
      liveId,
      senderId: userId,
      amountCents,
      status: 'pending',
      createdAt: Date.now(),
    });

    res.status(201).json({
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      amount,
      currency: 'EUR',
    });
  } catch (e) {
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
      } catch (e) {
        console.error('[donations] webhook credit error');
      }
    }

    const payment = db.donationPayments?.find((p) => p.paymentIntentId === intent.id);
    if (payment) payment.status = 'succeeded';
  }

  res.json({ received: true });
}
