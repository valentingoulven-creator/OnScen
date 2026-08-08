import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import Stripe from 'stripe';
import type { InvoiceWithLegacyFields } from '../lib/stripeLegacyTypes';
import { db } from '../models/schema';
import { authenticateJWT } from '../middleware/auth';
import { requireDevStaff } from '../middleware/requireAdmin';
import { getStripeClient } from '../lib/stripeClient';
import { persistDonationPaymentToPgAsync } from '../lib/pgDonations';
import { persistCreatorSubscriptionToPgAsync } from '../lib/pgSubscriptions';
import { logAdminAction } from '../lib/adminAuditLog';

export const adminPaymentsRouter = Router();

/** Journalise une action admin paiement : audit trail PG (migration 030) + console. */
function logAdminPaymentAction(
  action: string,
  details: Record<string, unknown> & { adminId: string; targetId?: string },
  req: Request
): void {
  console.log(`[admin][${action}]`, JSON.stringify({ at: new Date().toISOString(), ...details }));
  logAdminAction({
    adminId: details.adminId,
    action,
    targetType: 'payment',
    targetId: details.targetId,
    details,
    ip: req.ip,
  });
}

function refundIdempotencyKey(paymentIntentId: string, amountCents: number | undefined): string {
  return crypto
    .createHash('sha256')
    .update(`admin_refund:${paymentIntentId}:${amountCents ?? 'full'}`)
    .digest('hex');
}

/**
 * Remboursement (total ou partiel) d'un pourboire live via Stripe.
 * Body optionnel : { amountCents?: number, reason?: string }
 */
adminPaymentsRouter.post(
  '/donations/:id/refund',
  authenticateJWT,
  async (req: Request, res: Response) => {
    const adminId = requireDevStaff(req, res);
    if (!adminId) return;

    const payment = db.donationPayments.find((p) => p.id === req.params.id);
    if (!payment) {
      res.status(404).json({ error: 'Paiement introuvable' });
      return;
    }
    if (payment.status === 'refunded') {
      res.status(400).json({ error: 'Ce don a déjà été remboursé' });
      return;
    }
    if (payment.status !== 'succeeded') {
      res.status(400).json({ error: 'Seul un paiement confirmé (succeeded) peut être remboursé' });
      return;
    }

    const stripe = getStripeClient();
    if (!stripe) {
      res.status(503).json({ error: 'Stripe non configuré' });
      return;
    }

    const { amountCents, reason } = req.body as { amountCents?: number; reason?: string };
    const parsedAmount =
      typeof amountCents === 'number' && Number.isFinite(amountCents) && amountCents > 0
        ? Math.trunc(amountCents)
        : undefined;
    if (parsedAmount != null && parsedAmount > payment.amountCents) {
      res.status(400).json({ error: 'Le montant du remboursement dépasse le montant du don' });
      return;
    }

    try {
      const refund = await stripe.refunds.create(
        {
          payment_intent: payment.paymentIntentId,
          amount: parsedAmount,
          metadata: {
            adminId,
            donationPaymentId: payment.id,
            reason: reason?.trim().slice(0, 300) || '',
          },
        },
        { idempotencyKey: refundIdempotencyKey(payment.paymentIntentId, parsedAmount) }
      );

      payment.status = 'refunded';
      payment.refundId = refund.id;
      payment.refundedAmountCents = parsedAmount ?? payment.amountCents;
      payment.refundedAt = Date.now();
      payment.refundedBy = adminId;
      payment.refundReason = reason?.trim().slice(0, 300) || undefined;
      persistDonationPaymentToPgAsync(payment);

      logAdminPaymentAction(
        'donation_refund',
        {
          adminId,
          targetId: payment.id,
          donationPaymentId: payment.id,
          paymentIntentId: payment.paymentIntentId,
          amountCents: payment.refundedAmountCents,
          reason: payment.refundReason,
          refundId: refund.id,
        },
        req
      );

      res.json({
        refund: { id: refund.id, status: refund.status, amount: refund.amount },
        payment,
      });
    } catch (e) {
      if (e instanceof Stripe.errors.StripeError) {
        res.status(502).json({ error: e.message || 'Erreur Stripe lors du remboursement' });
        return;
      }
      console.error('[admin] donation refund error:', e);
      res.status(500).json({ error: 'Erreur interne lors du remboursement' });
    }
  }
);

/**
 * Annulation + remboursement (total ou partiel) de la dernière facture payée
 * d'un abonnement créateur / OnScen+ via Stripe.
 * Body optionnel : { amountCents?: number, reason?: string, cancelSubscription?: boolean }
 */
adminPaymentsRouter.post(
  '/subscriptions/:id/refund',
  authenticateJWT,
  async (req: Request, res: Response) => {
    const adminId = requireDevStaff(req, res);
    if (!adminId) return;

    const sub = db.creatorSubscriptions.find((s) => s.id === req.params.id);
    if (!sub) {
      res.status(404).json({ error: 'Abonnement introuvable' });
      return;
    }
    if (!sub.stripeSubscriptionId) {
      res.status(400).json({ error: 'Abonnement en simulation — aucun paiement Stripe à rembourser' });
      return;
    }

    const stripe = getStripeClient();
    if (!stripe) {
      res.status(503).json({ error: 'Stripe non configuré' });
      return;
    }

    const { amountCents, reason, cancelSubscription = true } = req.body as {
      amountCents?: number;
      reason?: string;
      cancelSubscription?: boolean;
    };
    const parsedAmount =
      typeof amountCents === 'number' && Number.isFinite(amountCents) && amountCents > 0
        ? Math.trunc(amountCents)
        : undefined;

    try {
      const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId, {
        expand: ['latest_invoice.payment_intent'],
      });
      const invoice = stripeSub.latest_invoice as InvoiceWithLegacyFields | null | undefined;
      const paymentIntentField = invoice?.payment_intent;
      const paymentIntentId =
        typeof paymentIntentField === 'string' ? paymentIntentField : paymentIntentField?.id;

      if (!paymentIntentId) {
        res.status(400).json({ error: 'Aucun paiement Stripe trouvé pour cet abonnement' });
        return;
      }

      const refund = await stripe.refunds.create(
        {
          payment_intent: paymentIntentId,
          amount: parsedAmount,
          metadata: {
            adminId,
            creatorSubscriptionId: sub.id,
            reason: reason?.trim().slice(0, 300) || '',
          },
        },
        { idempotencyKey: refundIdempotencyKey(paymentIntentId, parsedAmount) }
      );

      if (cancelSubscription) {
        try {
          await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
        } catch (err) {
          const code = (err as { code?: string }).code;
          if (code !== 'resource_missing') {
            console.warn('[admin] subscription cancel after refund failed:', err);
          }
        }
        sub.status = 'canceled';
      }

      sub.refundId = refund.id;
      sub.refundedAmountCents = parsedAmount ?? sub.amountCents;
      sub.refundedAt = Date.now();
      sub.refundedBy = adminId;
      sub.refundReason = reason?.trim().slice(0, 300) || undefined;
      sub.updatedAt = Date.now();
      persistCreatorSubscriptionToPgAsync(sub);

      logAdminPaymentAction(
        'subscription_refund',
        {
          adminId,
          targetId: sub.id,
          creatorSubscriptionId: sub.id,
          stripeSubscriptionId: sub.stripeSubscriptionId,
          paymentIntentId,
          amountCents: sub.refundedAmountCents,
          reason: sub.refundReason,
          refundId: refund.id,
          canceled: cancelSubscription,
        },
        req
      );

      res.json({
        refund: { id: refund.id, status: refund.status, amount: refund.amount },
        subscription: sub,
      });
    } catch (e) {
      if (e instanceof Stripe.errors.StripeError) {
        res.status(502).json({ error: e.message || 'Erreur Stripe lors du remboursement' });
        return;
      }
      console.error('[admin] subscription refund error:', e);
      res.status(500).json({ error: 'Erreur interne lors du remboursement' });
    }
  }
);
