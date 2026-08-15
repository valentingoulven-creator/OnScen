import type { Response } from 'express';
import { isProductionEnv } from './jwtSecret';
import { isStripeTestMode } from './stripeConfig';

function allowTestInProd(): boolean {
  const raw = process.env.STRIPE_ALLOW_TEST_IN_PROD?.trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

/** Bloque les encaissements « prod » tant que la clé est sk_test_. */
export function rejectIfStripeTestInProduction(res: Response): boolean {
  if (!isProductionEnv() || !isStripeTestMode() || allowTestInProd()) return false;
  res.status(503).json({
    error: 'Les paiements réels sont temporairement indisponibles.',
    code: 'STRIPE_TEST_IN_PROD',
  });
  return true;
}
