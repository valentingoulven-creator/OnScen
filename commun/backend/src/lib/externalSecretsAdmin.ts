import fs from 'fs';
import { getActiveEnvFilePath } from '../paths';
import { upsertEnvFileKeys } from './envFileWriter';
import {
  EXTERNAL_SECRET_PROVIDERS,
  FORMAT_VALIDATORS,
  getFieldDef,
  getProviderDef,
  type ExternalSecretFieldDef,
  type ExternalSecretProviderDef,
} from './externalSecretsRegistry';
import { getProviderIssues } from './externalSecretsAlerts';
import type { ExternalSecretIssue } from './externalSecretsAlerts';

/**
 * Moteur générique d'administration des clés/secrets d'API tierces
 * (onglet Admin → Intégrations), factorisé sur le même principe que
 * `stripeConfigAdmin.ts` (write-only, masqué, validé, appliqué à chaud dans
 * le `.env` actif via `upsertEnvFileKeys` — déjà générique, réutilisé tel
 * quel). Stripe garde son propre module dédié et n'est pas migré ici (déjà
 * testé, en prod) — la whitelist de ce module ne contient donc jamais les
 * variables STRIPE_*.
 *
 * Sécurité : `applyProviderConfig()` ne peut JAMAIS écrire une variable
 * absente de `EXTERNAL_SECRET_WHITELIST` (voir externalSecretsRegistry.ts) —
 * double vérification (par provider ET globale) même si la route a déjà
 * filtré les clés côté payload.
 */

export interface ExternalSecretFieldStatus {
  key: string;
  kind: ExternalSecretFieldDef['kind'];
  format: ExternalSecretFieldDef['format'];
  required: boolean;
  placeholder?: string;
  configured: boolean;
  /** Valeur en clair — uniquement pour les champs "public" configurés. */
  value: string | null;
  /** Aperçu masqué — uniquement pour les champs "secret" configurés. */
  masked: string | null;
}

export interface ExternalSecretProviderStatus {
  id: string;
  configured: boolean;
  helpUrl?: string;
  fields: ExternalSecretFieldStatus[];
  /** Problèmes détectés à la lecture — jamais une valeur en clair, voir externalSecretsAlerts.ts. */
  issues: ExternalSecretIssue[];
}

export interface ExternalSecretsStatusResponse {
  providers: ExternalSecretProviderStatus[];
  envFileFound: boolean;
}

export interface ExternalSecretFieldError {
  field: string;
  message: string;
}

/** Aperçu masqué générique `AbCd••••wxyz` — jamais la valeur complète. */
export function maskExternalSecretValue(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (trimmed.length <= 8) return '••••';
  return `${trimmed.slice(0, 4)}••••${trimmed.slice(-4)}`;
}

function fieldStatus(def: ExternalSecretFieldDef): ExternalSecretFieldStatus {
  const raw = process.env[def.key]?.trim();
  const configured = Boolean(raw);
  return {
    key: def.key,
    kind: def.kind,
    format: def.format,
    required: def.required,
    placeholder: def.placeholder,
    configured,
    value: def.kind === 'public' && configured ? raw! : null,
    masked: def.kind === 'secret' && configured ? maskExternalSecretValue(raw) : null,
  };
}

export function getProviderStatus(providerDef: ExternalSecretProviderDef): ExternalSecretProviderStatus {
  const fields = providerDef.fields.map(fieldStatus);
  const requiredFields = fields.filter((f) => f.required);
  const configured =
    requiredFields.length > 0 ? requiredFields.every((f) => f.configured) : fields.some((f) => f.configured);
  return {
    id: providerDef.id,
    configured,
    helpUrl: providerDef.helpUrl,
    fields,
    issues: getProviderIssues(providerDef),
  };
}

export function getExternalSecretsStatus(opts: { envPath?: string } = {}): ExternalSecretsStatusResponse {
  const envPath = opts.envPath ?? getActiveEnvFilePath();
  return {
    providers: EXTERNAL_SECRET_PROVIDERS.map(getProviderStatus),
    envFileFound: fs.existsSync(envPath),
  };
}

/**
 * Valide les champs fournis pour un provider donné. Ne valide QUE les clés
 * whitelistées pour ce provider — toute clé étrangère au provider déclenche
 * une erreur explicite (défense en profondeur, la route filtre déjà en
 * amont).
 */
export function validateProviderInput(
  providerId: string,
  values: Record<string, string | undefined>
): ExternalSecretFieldError[] {
  const providerDef = getProviderDef(providerId);
  if (!providerDef) {
    return [{ field: providerId, message: `Provider inconnu : ${providerId}` }];
  }

  const errors: ExternalSecretFieldError[] = [];
  const allowedKeys = new Set(providerDef.fields.map((f) => f.key));

  for (const key of Object.keys(values)) {
    if (!allowedKeys.has(key)) {
      errors.push({ field: key, message: `Variable non autorisée pour ce provider : ${key}` });
    }
  }

  for (const field of providerDef.fields) {
    const raw = values[field.key]?.trim() ?? '';
    if (!raw) {
      if (field.required) {
        errors.push({ field: field.key, message: 'Champ requis' });
      }
      continue;
    }
    const validator = FORMAT_VALIDATORS[field.format];
    if (!validator.re.test(raw)) {
      errors.push({ field: field.key, message: validator.message });
    }
  }

  return errors;
}

export interface ApplyProviderConfigOptions {
  /** Override pour les tests — sinon résolu via getActiveEnvFilePath(). */
  envPathOverride?: string;
}

/**
 * Applique la config d'un provider : persiste dans le `.env` actif
 * (append/replace, sans toucher aux autres variables) puis met à jour
 * `process.env` pour un effet immédiat. Les champs optionnels laissés vides
 * ne sont jamais écrits (la valeur existante, si elle existe, n'est pas
 * effacée par une saisie vide).
 *
 * Ne crée jamais un nouveau fichier `.env` : si le fichier résolu n'existe
 * pas, on refuse (même garde-fou que `applyStripeConfig`).
 *
 * SÉCURITÉ : lève une erreur si l'appelant tente d'écrire une clé qui n'est
 * pas déclarée pour CE provider dans le registre — aucune clé arbitraire ne
 * peut jamais atteindre `upsertEnvFileKeys`.
 */
export function applyProviderConfig(
  providerId: string,
  values: Record<string, string | undefined>,
  options: ApplyProviderConfigOptions = {}
): ExternalSecretProviderStatus {
  const providerDef = getProviderDef(providerId);
  if (!providerDef) {
    throw new Error(`Provider inconnu : ${providerId}`);
  }

  const allowedKeys = new Set(providerDef.fields.map((f) => f.key));
  const updates: Record<string, string> = {};
  for (const [key, rawValue] of Object.entries(values)) {
    if (!allowedKeys.has(key)) {
      throw new Error(`Variable non autorisée pour ce provider : ${key}`);
    }
    const trimmed = rawValue?.trim();
    if (trimmed) updates[key] = trimmed;
  }

  if (Object.keys(updates).length === 0) {
    return getProviderStatus(providerDef);
  }

  const envPath = options.envPathOverride ?? getActiveEnvFilePath();
  if (!fs.existsSync(envPath)) {
    throw new Error(
      `Fichier .env introuvable (${envPath}) — vérifiez le déploiement avant d'appliquer cette configuration.`
    );
  }

  upsertEnvFileKeys(envPath, updates);

  for (const [key, value] of Object.entries(updates)) {
    process.env[key] = value;
  }

  return getProviderStatus(providerDef);
}

export { getProviderDef, getFieldDef };
