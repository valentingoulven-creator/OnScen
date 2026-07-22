import { FORMAT_VALIDATORS, type ExternalSecretProviderDef } from './externalSecretsRegistry';
import { isProductionEnv } from './jwtSecret';

/**
 * Détection de problèmes sur les clés d'API tierces déjà en place (lecture
 * du `.env` actif), généralisant le principe de l'alerte
 * `stripe_test_on_production` (prodSaasStatus.ts) à tous les providers du
 * registre. Volontairement conservateur : chaque règle est un signal fiable
 * et documenté, jamais une heuristique floue — pas de faux positif.
 *
 * SÉCURITÉ : ne manipule que des booléens/regex sur `process.env` — une
 * `ExternalSecretIssue` ne contient JAMAIS la valeur elle-même, uniquement
 * son type, sa sévérité et le nom de la variable concernée.
 */

export type ExternalSecretIssueType =
  | 'partial_config'
  | 'placeholder_value'
  | 'invalid_format'
  | 'test_mode_in_production';

export type ExternalSecretIssueSeverity = 'critical' | 'warning' | 'info';

export interface ExternalSecretIssue {
  type: ExternalSecretIssueType;
  severity: ExternalSecretIssueSeverity;
  /** Nom de la variable concernée — jamais sa valeur. */
  field: string;
  /** Clé i18n prête à l'emploi (admin.integrations.issues.*), réutilisée par prodSaasStatus.ts. */
  messageKey: string;
}

const ISSUE_MESSAGE_KEY: Record<ExternalSecretIssueType, string> = {
  partial_config: 'admin.integrations.issues.partialConfig',
  placeholder_value: 'admin.integrations.issues.placeholderValue',
  invalid_format: 'admin.integrations.issues.invalidFormat',
  test_mode_in_production: 'admin.integrations.issues.testModeInProduction',
};

/**
 * Valeurs "exemple" bien connues laissées par erreur après un copier-coller
 * de `.env.production.example` (JWT_SECRET=changez_moi_…,
 * PROD_ADMIN_PASSWORD=changez_moi, TURN_CREDENTIAL=changez_moi…) ou des
 * identifiants de développement local publics (LiveKit `--dev` :
 * devkey/secret). Comparaison EXACTE (insensible à la casse) uniquement —
 * jamais une correspondance partielle, pour exclure tout faux positif sur
 * une vraie clé qui contiendrait accidentellement l'un de ces mots.
 */
const KNOWN_PLACEHOLDER_VALUES = new Set([
  'changez_moi',
  'change_me',
  'changeme',
  'change_this',
  'your_key_here',
  'your-key-here',
  'your_api_key',
  'your_secret_here',
  'replace_me',
  'placeholder',
  'todo',
  'devkey',
  'secret',
  'test',
  'password',
  'example',
  'xxx',
  'xxxxxxxx',
  '123456',
  'changeme123',
]);

function isKnownPlaceholder(raw: string): boolean {
  return KNOWN_PLACEHOLDER_VALUES.has(raw.trim().toLowerCase());
}

/**
 * Signal "mode test/sandbox en production" documenté dans
 * `.env.production.example` : `RESEND_FROM` avec le domaine `resend.dev`
 * n'est valide que sans domaine vérifié (100 emails/jour, expéditeur non
 * fiable) — ne devrait jamais rester en production. Généralise le principe
 * `stripe_test_on_production` aux autres providers, uniquement là où un
 * indicateur test/sandbox fiable existe réellement (pas d'invention).
 */
const TEST_INDICATOR_PATTERNS: Partial<Record<string, RegExp>> = {
  RESEND_FROM: /resend\.dev/i,
};

function issue(
  type: ExternalSecretIssueType,
  severity: ExternalSecretIssueSeverity,
  field: string
): ExternalSecretIssue {
  return { type, severity, field, messageKey: ISSUE_MESSAGE_KEY[type] };
}

/**
 * Calcule les problèmes détectés pour un provider donné, à partir de
 * `process.env` (jamais de valeur renvoyée, uniquement le diagnostic).
 */
export function getProviderIssues(providerDef: ExternalSecretProviderDef): ExternalSecretIssue[] {
  const issues: ExternalSecretIssue[] = [];

  const configuredFields = providerDef.fields.filter((f) => process.env[f.key]?.trim());
  const missingRequiredFields = providerDef.fields.filter((f) => f.required && !process.env[f.key]?.trim());

  // 2. Clé requise manquante — signalé uniquement si le provider est déjà
  // partiellement renseigné (signal fiable de config cassée) ; un provider
  // entièrement vide reste "non configuré" (feature optionnelle non activée,
  // pas une alerte).
  if (configuredFields.length > 0 && missingRequiredFields.length > 0) {
    for (const field of missingRequiredFields) {
      issues.push(issue('partial_config', 'critical', field.key));
    }
  }

  for (const field of providerDef.fields) {
    const raw = process.env[field.key]?.trim();
    if (!raw) continue;

    // 4. Valeur identique à un exemple/placeholder connu.
    if (isKnownPlaceholder(raw)) {
      issues.push(issue('placeholder_value', 'critical', field.key));
    }

    // 3. Format invalide à la lecture (dérive depuis la saisie initiale —
    // édition manuelle du .env par SSH, valeur tronquée, mauvais préfixe…).
    if (!FORMAT_VALIDATORS[field.format].re.test(raw)) {
      issues.push(issue('invalid_format', 'warning', field.key));
    }

    // 1. Mode test/sandbox détecté alors que l'app tourne en production.
    const testPattern = TEST_INDICATOR_PATTERNS[field.key];
    if (testPattern && isProductionEnv() && testPattern.test(raw)) {
      issues.push(issue('test_mode_in_production', 'critical', field.key));
    }
  }

  return issues;
}
