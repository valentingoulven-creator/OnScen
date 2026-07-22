import fs from 'fs';
import { getActiveEnvFilePath } from '../paths';
import { upsertEnvFileKeys } from './envFileWriter';
import { getStripeKeyMode, type StripeKeyMode } from './stripeConfig';

/**
 * Permet à un founder/admin (rôle Dev staff) de saisir/mettre à jour les clés
 * Stripe live directement depuis l'admin, sans SSH ni édition manuelle du
 * `.env` sur le VPS. Voir routes/adminStripeConfig.ts pour les endpoints.
 *
 * Sécurité : la clé secrète et le secret webhook ne sont JAMAIS renvoyés en
 * clair — seul un aperçu masqué (préfixe + 4 derniers caractères) est exposé
 * au frontend (voir `maskStripeSecret`).
 *
 * Rechargement à chaud : `getStripeClient()` (stripeClient.ts) recrée son
 * instance Stripe dès que `process.env.STRIPE_SECRET_KEY` change (cache par
 * clé) ; `STRIPE_PUBLISHABLE_KEY` et `STRIPE_WEBHOOK_SECRET` sont lus depuis
 * `process.env` à chaque requête (routes/donations.ts, routes/subscriptions.ts).
 * Aucun redémarrage PM2 n'est donc nécessaire après application.
 */

export interface StripeConfigInput {
  secretKey: string;
  publishableKey: string;
  webhookSecret?: string;
}

export type StripeConfigFieldErrorField = 'secretKey' | 'publishableKey' | 'webhookSecret' | 'mode';

export interface StripeConfigFieldError {
  field: StripeConfigFieldErrorField;
  message: string;
}

export interface StripeConfigStatus {
  configured: boolean;
  mode: StripeKeyMode;
  secretKeyMasked: string | null;
  publishableKeyMasked: string | null;
  webhookSecretConfigured: boolean;
  webhookSecretMasked: string | null;
  donationsEnabled: boolean;
  subscriptionsEnabled: boolean;
  envFileFound: boolean;
  /** stripeClient.ts recrée son instance dès que la clé change — pas de redémarrage requis. */
  hotReload: true;
}

const SECRET_KEY_RE = /^sk_(live|test)_[A-Za-z0-9]{16,}$/;
const PUBLISHABLE_KEY_RE = /^pk_(live|test)_[A-Za-z0-9]{16,}$/;
const WEBHOOK_SECRET_RE = /^whsec_[A-Za-z0-9]{16,}$/;

/** Aperçu masqué type `sk_live_••••1234` — jamais la valeur complète. */
export function maskStripeSecret(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const prefixMatch = trimmed.match(/^(sk_live_|sk_test_|pk_live_|pk_test_|whsec_)/);
  const prefix = prefixMatch ? prefixMatch[1] : '';
  const last4 = trimmed.slice(-4);
  return `${prefix}••••${last4}`;
}

export function validateStripeConfigInput(input: Partial<StripeConfigInput>): StripeConfigFieldError[] {
  const errors: StripeConfigFieldError[] = [];
  const secretKey = input.secretKey?.trim() ?? '';
  const publishableKey = input.publishableKey?.trim() ?? '';
  const webhookSecret = input.webhookSecret?.trim() ?? '';

  const secretValid = SECRET_KEY_RE.test(secretKey);
  const publishableValid = PUBLISHABLE_KEY_RE.test(publishableKey);

  if (!secretValid) {
    errors.push({
      field: 'secretKey',
      message:
        'Clé secrète invalide — attendu le format sk_live_… ou sk_test_… (Stripe Dashboard → Développeurs → Clés API).',
    });
  }
  if (!publishableValid) {
    errors.push({
      field: 'publishableKey',
      message: 'Clé publique invalide — attendu le format pk_live_… ou pk_test_….',
    });
  }
  if (webhookSecret && !WEBHOOK_SECRET_RE.test(webhookSecret)) {
    errors.push({
      field: 'webhookSecret',
      message: 'Secret webhook invalide — attendu le format whsec_… (Stripe Dashboard → Webhooks → Signing secret).',
    });
  }
  if (secretValid && publishableValid) {
    const secretMode = secretKey.startsWith('sk_live_') ? 'live' : 'test';
    const pubMode = publishableKey.startsWith('pk_live_') ? 'live' : 'test';
    if (secretMode !== pubMode) {
      errors.push({
        field: 'mode',
        message: 'La clé secrète et la clé publique doivent être du même mode (les deux en live, ou les deux en test).',
      });
    }
  }
  return errors;
}

export function getStripeConfigStatus(opts: { envPath?: string } = {}): StripeConfigStatus {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY?.trim();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const envPath = opts.envPath ?? getActiveEnvFilePath();
  return {
    configured: Boolean(secretKey),
    mode: getStripeKeyMode(),
    secretKeyMasked: maskStripeSecret(secretKey),
    publishableKeyMasked: maskStripeSecret(publishableKey),
    webhookSecretConfigured: Boolean(webhookSecret),
    webhookSecretMasked: maskStripeSecret(webhookSecret),
    donationsEnabled: process.env.DONATIONS_ENABLED === '1',
    subscriptionsEnabled: process.env.SUBSCRIPTIONS_ENABLED === '1',
    envFileFound: fs.existsSync(envPath),
    hotReload: true,
  };
}

export interface ApplyStripeConfigOptions {
  /** Override pour les tests — sinon résolu via getActiveEnvFilePath(). */
  envPathOverride?: string;
}

/**
 * Applique la config Stripe : persiste dans le `.env` actif (append/replace,
 * sans toucher aux autres variables) puis met à jour `process.env` pour un
 * effet immédiat (aucun redémarrage requis — voir stripeClient.ts).
 *
 * Ne crée jamais un nouveau fichier `.env` : si le fichier résolu n'existe
 * pas, on refuse (l'admin doit vérifier le déploiement / SSH plutôt que de
 * créer un `.env` incomplet qui casserait les autres secrets déjà en place).
 */
export function applyStripeConfig(
  input: StripeConfigInput,
  options: ApplyStripeConfigOptions = {}
): StripeConfigStatus {
  const secretKey = input.secretKey.trim();
  const publishableKey = input.publishableKey.trim();
  const webhookSecret = input.webhookSecret?.trim();

  const envPath = options.envPathOverride ?? getActiveEnvFilePath();
  if (!fs.existsSync(envPath)) {
    throw new Error(
      `Fichier .env introuvable (${envPath}) — vérifiez le déploiement avant d'appliquer la clé Stripe.`
    );
  }

  const updates: Record<string, string> = {
    STRIPE_SECRET_KEY: secretKey,
    STRIPE_PUBLISHABLE_KEY: publishableKey,
  };
  if (webhookSecret) {
    updates.STRIPE_WEBHOOK_SECRET = webhookSecret;
  }

  upsertEnvFileKeys(envPath, updates);

  process.env.STRIPE_SECRET_KEY = secretKey;
  process.env.STRIPE_PUBLISHABLE_KEY = publishableKey;
  if (webhookSecret) {
    process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;
  }

  return getStripeConfigStatus({ envPath });
}
