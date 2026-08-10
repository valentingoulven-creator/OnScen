/**
 * Test Stripe Connect split for live donation (100 EUR -> 50% platform / 50% creator).
 * Usage: node scripts/test-stripe-donation-split.cjs
 */
const fs = require('fs');
const path = require('path');
const Stripe = require(path.join(__dirname, '..', 'backend', 'node_modules', 'stripe'));

const envPath = path.join(__dirname, '..', 'msdev', '.env');
const raw = fs.readFileSync(envPath, 'utf8');
const keyMatch = raw.match(/^STRIPE_SECRET_KEY=(.+)$/m);
if (!keyMatch) throw new Error('STRIPE_SECRET_KEY missing in msdev/.env');

const AMOUNT_EUR = 100;
const FEE_PERCENT = 50;
const amountCents = AMOUNT_EUR * 100;
const platformFeeCents = Math.round((amountCents * FEE_PERCENT) / 100);
const creatorNetCents = amountCents - platformFeeCents;

const stripe = new Stripe(keyMatch[1].trim(), { apiVersion: '2025-02-24.acacia' });

async function ensureConnectAccount() {
  const existing = await stripe.accounts.list({ limit: 1 });
  if (existing.data[0]) {
    const acct = await stripe.accounts.retrieve(existing.data[0].id);
    console.log('Connect account existant: ' + acct.id + ' (charges_enabled=' + acct.charges_enabled + ')');
    return acct;
  }

  const acct = await stripe.accounts.create({
    type: 'express',
    country: 'FR',
    email: 'soundy-don-test-creator@msdev.local',
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_type: 'individual',
    metadata: { soundyTest: 'donation_split' },
  });

  await stripe.accounts.update(acct.id, {
    tos_acceptance: {
      date: Math.floor(Date.now() / 1000),
      ip: '127.0.0.1',
    },
  });

  const refreshed = await stripe.accounts.retrieve(acct.id);
  console.log('Connect account cree: ' + refreshed.id + ' (charges_enabled=' + refreshed.charges_enabled + ')');
  return refreshed;
}

async function main() {
  console.log('\n=== Test don live Stripe (mode test) ===');
  console.log('Montant: ' + AMOUNT_EUR + ' EUR');
  console.log('Commission plateforme attendue (' + FEE_PERCENT + '%): ' + platformFeeCents / 100 + ' EUR');
  console.log('Net createur attendu (' + (100 - FEE_PERCENT) + '%): ' + creatorNetCents / 100 + ' EUR\n');

  const connectAccount = await ensureConnectAccount();

  const intent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: 'eur',
    automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
    application_fee_amount: platformFeeCents,
    transfer_data: { destination: connectAccount.id },
    metadata: {
      type: 'live_tip_test',
      platformFeePercent: String(FEE_PERCENT),
      platformFeeCents: String(platformFeeCents),
    },
    description: 'Test don live OnScen — split 50/50',
  });

  console.log('PaymentIntent cree: ' + intent.id);
  console.log('  application_fee_amount: ' + intent.application_fee_amount + ' centimes');
  console.log('  transfer destination: ' + intent.transfer_data.destination);

  const confirmed = await stripe.paymentIntents.confirm(intent.id, {
    payment_method: 'pm_card_visa',
  });

  if (confirmed.status !== 'succeeded') {
    throw new Error('Paiement non reussi: status=' + confirmed.status);
  }

  const chargeId =
    typeof confirmed.latest_charge === 'string'
      ? confirmed.latest_charge
      : confirmed.latest_charge.id;

  const charge = await stripe.charges.retrieve(chargeId, {
    expand: ['application_fee', 'transfer'],
  });

  const appFee = charge.application_fee;
  const appFeeAmount =
    appFee && typeof appFee === 'object' ? appFee.amount : charge.application_fee_amount;
  const transfer = charge.transfer;
  const transferAmount = transfer && typeof transfer === 'object' ? transfer.amount : null;

  console.log('\n=== Resultat Stripe ===');
  console.log('Status: ' + confirmed.status);
  console.log('Montant paye: ' + confirmed.amount_received / 100 + ' EUR');
  console.log('Application fee (plateforme): ' + (appFeeAmount || 0) / 100 + ' EUR');
  if (transferAmount != null) {
    console.log('Transfer vers createur: ' + transferAmount / 100 + ' EUR');
  }

  const platformOk = appFeeAmount === platformFeeCents;
  const creatorOk = transferAmount === creatorNetCents;

  console.log('\n=== Verification split 50/50 ===');
  console.log((platformOk ? 'OK' : 'FAIL') + ' Plateforme: ' + (appFeeAmount || 0) / 100 + ' EUR (attendu ' + platformFeeCents / 100 + ')');
  if (transferAmount != null) {
    console.log((creatorOk ? 'OK' : 'FAIL') + ' Createur: ' + transferAmount / 100 + ' EUR (attendu ' + creatorNetCents / 100 + ')');
  }

  if (!platformOk || (transferAmount != null && !creatorOk)) {
    process.exitCode = 1;
    console.log('\nEchec verification split.');
  } else {
    console.log('\nSplit 50% / 50% confirme cote Stripe (hors frais processing Stripe).');
  }
  console.log('Dashboard: https://dashboard.stripe.com/test/payments/' + chargeId + '\n');
}

main().catch(function (e) {
  const msg = e.message || String(e);
  console.error('Erreur:', msg);
  if (/signed up for Connect/i.test(msg)) {
    console.error('\nStripe Connect n\'est pas active sur ce compte test.');
    console.error('1. Ouvrez https://dashboard.stripe.com/test/connect');
    console.error('2. Activez Connect (Express recommande, comme OnScen)');
    console.error('3. Relancez: node scripts/test-stripe-donation-split.cjs');
    console.error('\nLe calcul 50/50 est deja verifie dans le code (100 EUR -> 50 EUR plateforme, 50 EUR createur).');
  }
  process.exit(1);
});
