/**
 * Registre générique des providers d'API externes gérables depuis l'admin
 * (onglet Admin → Intégrations), sur le même principe que la config Stripe
 * live (`stripeConfigAdmin.ts`) : saisie write-only, masquage après coup,
 * validation de format, application à chaud dans le `.env` actif.
 *
 * SÉCURITÉ CRITIQUE : c'est l'UNIQUE source de vérité pour la whitelist des
 * variables d'environnement éditables via `/api/admin/external-secrets`.
 * Toute variable absente de ce registre est refusée par
 * `externalSecretsAdmin.ts` — impossible d'écraser des variables système
 * (DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY, OPS_HEALTH_TOKEN,
 * TOTP_ENCRYPTION_KEY, PROD_ADMIN_*, REDIS_URL, …) via cet endpoint, même si
 * un client malveillant envoie un nom de variable arbitraire.
 *
 * Stripe garde son propre module dédié (`stripeConfigAdmin.ts` /
 * `routes/adminStripeConfig.ts`, déjà testé — 16 tests) et n'est PAS
 * dupliqué ici : la carte Stripe existante est simplement réutilisée dans
 * le même onglet « Intégrations » côté frontend.
 */

/** Variable "secret" — toujours masquée après saisie (jamais réaffichée en clair). */
export type ExternalSecretFieldKind = 'secret' | 'public';

/**
 * Format de validation générique appliqué à un champ. Évite de dupliquer une
 * regex par variable (30+ variables) tout en gardant une validation
 * pertinente par nature de valeur.
 */
export type ExternalSecretFieldFormat = 'token' | 'id' | 'httpUrl' | 'wsUrl' | 'mailtoOrUrl' | 'freeText';

export interface ExternalSecretFieldDef {
  /** Nom exact de la variable d'environnement (whitelist). */
  key: string;
  kind: ExternalSecretFieldKind;
  format: ExternalSecretFieldFormat;
  /** Si false, le champ est optionnel : le provider peut être "configuré" sans lui. */
  required: boolean;
  placeholder?: string;
}

export interface ExternalSecretProviderDef {
  /** Identifiant stable utilisé dans l'URL (`PUT /external-secrets/:provider`) et les clés i18n. */
  id: string;
  fields: ExternalSecretFieldDef[];
  /** Lien doc/console externe optionnel affiché côté admin. */
  helpUrl?: string;
}

export const EXTERNAL_SECRET_PROVIDERS: ExternalSecretProviderDef[] = [
  {
    id: 'google_oauth',
    helpUrl: 'https://console.cloud.google.com/apis/credentials',
    fields: [
      { key: 'GOOGLE_CLIENT_ID', kind: 'public', format: 'id', required: true, placeholder: '123456789-xxxx.apps.googleusercontent.com' },
      { key: 'GOOGLE_CLIENT_SECRET', kind: 'secret', format: 'token', required: true, placeholder: 'GOCSPX-…' },
      { key: 'GOOGLE_CALLBACK_URL', kind: 'public', format: 'httpUrl', required: true, placeholder: 'https://getsoundy.com/api/auth/google/callback' },
      { key: 'YOUTUBE_CALLBACK_URL', kind: 'public', format: 'httpUrl', required: false, placeholder: 'https://getsoundy.com/api/auth/youtube/callback' },
    ],
  },
  {
    id: 'youtube_data_api',
    helpUrl: 'https://console.cloud.google.com/apis/library/youtube.googleapis.com',
    fields: [
      { key: 'YOUTUBE_API_KEY', kind: 'secret', format: 'token', required: true, placeholder: 'AIzaSy…' },
    ],
  },
  {
    id: 'facebook_instagram',
    helpUrl: 'https://developers.facebook.com/apps',
    fields: [
      { key: 'FACEBOOK_APP_ID', kind: 'public', format: 'id', required: true, placeholder: '123456789012345' },
      { key: 'FACEBOOK_APP_SECRET', kind: 'secret', format: 'token', required: true, placeholder: '32 caractères hexadécimaux' },
      { key: 'FACEBOOK_CALLBACK_URL', kind: 'public', format: 'httpUrl', required: true, placeholder: 'https://getsoundy.com/api/auth/facebook/callback' },
      { key: 'INSTAGRAM_CALLBACK_URL', kind: 'public', format: 'httpUrl', required: false, placeholder: 'https://getsoundy.com/api/auth/instagram/callback' },
    ],
  },
  {
    id: 'cloudflare_stream',
    helpUrl: 'https://dash.cloudflare.com/?to=/:account/stream',
    fields: [
      { key: 'CLOUDFLARE_ACCOUNT_ID', kind: 'public', format: 'id', required: true, placeholder: '32 caractères hexadécimaux' },
      { key: 'CLOUDFLARE_STREAM_API_TOKEN', kind: 'secret', format: 'token', required: true, placeholder: '40 caractères' },
      { key: 'CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN', kind: 'public', format: 'id', required: false, placeholder: 'm033z5x00ks6nunl' },
    ],
  },
  {
    id: 'livekit',
    helpUrl: 'https://cloud.livekit.io',
    fields: [
      { key: 'LIVEKIT_URL', kind: 'public', format: 'wsUrl', required: true, placeholder: 'wss://votre-projet.livekit.cloud' },
      { key: 'LIVEKIT_API_KEY', kind: 'secret', format: 'token', required: true, placeholder: 'APIxxxxxxxx' },
      { key: 'LIVEKIT_API_SECRET', kind: 'secret', format: 'token', required: true, placeholder: '32+ caractères' },
    ],
  },
  {
    id: 'sightengine',
    helpUrl: 'https://sightengine.com/',
    fields: [
      { key: 'SIGHTENGINE_API_USER', kind: 'public', format: 'id', required: true, placeholder: 'Identifiant API' },
      { key: 'SIGHTENGINE_API_SECRET', kind: 'secret', format: 'token', required: true, placeholder: 'Clé secrète API' },
    ],
  },
  {
    id: 'acrcloud',
    helpUrl: 'https://www.acrcloud.com/',
    fields: [
      { key: 'ACRCLOUD_ACCESS_KEY', kind: 'public', format: 'id', required: true, placeholder: 'Access key' },
      { key: 'ACRCLOUD_ACCESS_SECRET', kind: 'secret', format: 'token', required: true, placeholder: 'Access secret' },
      { key: 'ACRCLOUD_HOST', kind: 'public', format: 'httpUrl', required: false, placeholder: 'https://identify-eu-west-1.acrcloud.com' },
    ],
  },
  {
    id: 's3_scaleway',
    helpUrl: 'https://console.scaleway.com/object-storage/buckets',
    fields: [
      { key: 'S3_BUCKET', kind: 'public', format: 'id', required: true, placeholder: 'soundy-uploads' },
      { key: 'S3_REGION', kind: 'public', format: 'id', required: true, placeholder: 'fr-par' },
      { key: 'S3_ENDPOINT', kind: 'public', format: 'httpUrl', required: true, placeholder: 'https://s3.fr-par.scw.cloud' },
      { key: 'S3_ACCESS_KEY_ID', kind: 'secret', format: 'token', required: true, placeholder: 'SCW…' },
      { key: 'S3_SECRET_ACCESS_KEY', kind: 'secret', format: 'token', required: true, placeholder: '40+ caractères' },
      { key: 'S3_PUBLIC_BASE_URL', kind: 'public', format: 'httpUrl', required: false, placeholder: 'https://cdn.getsoundy.com' },
    ],
  },
  {
    id: 'resend_email',
    helpUrl: 'https://resend.com/api-keys',
    fields: [
      { key: 'RESEND_API_KEY', kind: 'secret', format: 'token', required: true, placeholder: 're_…' },
      { key: 'RESEND_FROM', kind: 'public', format: 'freeText', required: false, placeholder: 'Soundy <noreply@getsoundy.com>' },
    ],
  },
  {
    id: 'ai_agents',
    helpUrl: 'https://console.anthropic.com/settings/keys',
    fields: [
      { key: 'ANTHROPIC_API_KEY', kind: 'secret', format: 'token', required: false, placeholder: 'sk-ant-…' },
      { key: 'OPENAI_API_KEY', kind: 'secret', format: 'token', required: false, placeholder: 'sk-…' },
    ],
  },
  {
    id: 'web_push',
    helpUrl: 'https://web.dev/push-notifications-web-push-protocol/',
    fields: [
      { key: 'VAPID_PUBLIC_KEY', kind: 'public', format: 'token', required: true, placeholder: 'BN…' },
      { key: 'VAPID_PRIVATE_KEY', kind: 'secret', format: 'token', required: true, placeholder: '…' },
      { key: 'VAPID_SUBJECT', kind: 'public', format: 'mailtoOrUrl', required: false, placeholder: 'mailto:admin@getsoundy.com' },
    ],
  },
  {
    id: 'turn',
    helpUrl: undefined,
    fields: [
      { key: 'TURN_URL', kind: 'public', format: 'freeText', required: true, placeholder: 'turn:51.159.164.100:3478?transport=udp' },
      { key: 'TURN_USERNAME', kind: 'public', format: 'id', required: true, placeholder: 'soundy' },
      { key: 'TURN_CREDENTIAL', kind: 'secret', format: 'token', required: true, placeholder: '…' },
    ],
  },
];

/**
 * Validateurs génériques par format — utilisés à la saisie
 * (`externalSecretsAdmin.ts`) ET à la lecture pour détecter une valeur en
 * place qui ne respecte plus le format attendu (`externalSecretsAlerts.ts`,
 * ex. modification manuelle du `.env` par SSH qui aurait tronqué/corrompu
 * la valeur). Une seule source de vérité pour les deux usages.
 */
export const FORMAT_VALIDATORS: Record<ExternalSecretFieldFormat, { re: RegExp; message: string }> = {
  token: { re: /^\S{8,}$/, message: 'Valeur invalide — attendu au moins 8 caractères sans espace.' },
  id: { re: /^\S{2,}$/, message: 'Valeur invalide — attendu au moins 2 caractères sans espace.' },
  httpUrl: { re: /^https?:\/\/\S+$/, message: 'URL invalide — attendu un lien commençant par http:// ou https://' },
  wsUrl: { re: /^wss?:\/\/\S+$/, message: 'URL invalide — attendu un lien commençant par ws:// ou wss://' },
  mailtoOrUrl: {
    re: /^(mailto:\S+@\S+|https?:\/\/\S+)$/,
    message: 'Valeur invalide — attendu mailto:contact@example.com ou une URL https://…',
  },
  freeText: { re: /\S/, message: 'Champ requis' },
};

export function getProviderDef(id: string): ExternalSecretProviderDef | undefined {
  return EXTERNAL_SECRET_PROVIDERS.find((p) => p.id === id);
}

export function getFieldDef(providerDef: ExternalSecretProviderDef, key: string): ExternalSecretFieldDef | undefined {
  return providerDef.fields.find((f) => f.key === key);
}

/**
 * Whitelist stricte de TOUTES les variables éditables via ce système —
 * dérivée automatiquement du registre ci-dessus. Toute clé absente de cet
 * ensemble est refusée par `applyProviderConfig()`. Ne contient jamais de
 * variable "cœur système" (DB, JWT, chiffrement, tokens ops) : seules des
 * clés d'API tierces y figurent, une par une, explicitement déclarées.
 */
export const EXTERNAL_SECRET_WHITELIST: ReadonlySet<string> = new Set(
  EXTERNAL_SECRET_PROVIDERS.flatMap((p) => p.fields.map((f) => f.key))
);
