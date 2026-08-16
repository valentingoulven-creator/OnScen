/**
 * Compte / projet lié à une clé d'API (onglet Admin → Intégrations).
 * Jamais une valeur secrète : e-mail de facturation, nom d'affichage, id projet.
 */

export type IntegrationAccountSource = 'live' | 'derived' | 'declared';

export interface IntegrationAccount {
  /** E-mail de connexion / facturation du dashboard provider, si connu. */
  email: string | null;
  /** Libellé humain (raison sociale, projet, zone). */
  name: string | null;
  /** Identifiant public (projet GCP, acct Stripe, bucket, API user…). */
  project: string | null;
  source: IntegrationAccountSource;
}

/** E-mail opérateur OnScen confirmé sur Stripe (API Account) et Google Cloud. */
export const ONSCEN_OPERATOR_EMAIL = 'valentin.goulven@gmail.com';

export function emptyAccount(): IntegrationAccount {
  return { email: null, name: null, project: null, source: 'declared' };
}

export function hasAccountDetails(account: IntegrationAccount | null | undefined): boolean {
  return Boolean(account && (account.email || account.name || account.project));
}

export function parseAngleEmail(raw: string | undefined | null): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const angled = trimmed.match(/<([^>]+@[^>]+)>/);
  if (angled?.[1]) return angled[1].trim();
  const mailto = trimmed.match(/^mailto:(.+)$/i);
  if (mailto?.[1]) return mailto[1].trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return trimmed;
  return null;
}

export function googleProjectNumberFromClientId(clientId: string | undefined | null): string | null {
  const trimmed = clientId?.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d+)-/);
  return match?.[1] ?? null;
}

export function livekitProjectFromUrl(url: string | undefined | null): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  try {
    const host = new URL(trimmed).hostname;
    const slug = host.replace(/\.livekit\.cloud$/i, '');
    return slug && slug !== host ? slug : host || null;
  } catch {
    const host = trimmed.replace(/^wss?:\/\//i, '').split('/')[0] ?? '';
    const slug = host.replace(/\.livekit\.cloud$/i, '');
    return slug || null;
  }
}

function account(
  partial: Partial<IntegrationAccount> & Pick<IntegrationAccount, 'source'>
): IntegrationAccount {
  return {
    email: partial.email ?? null,
    name: partial.name ?? null,
    project: partial.project ?? null,
    source: partial.source,
  };
}

/**
 * Compte lié à un provider du registre `externalSecretsRegistry`.
 * Dérivé des variables publiques + e-mail opérateur quand il est établi.
 */
export function resolveProviderAccount(providerId: string): IntegrationAccount | null {
  switch (providerId) {
    case 'google_oauth':
    case 'youtube_data_api': {
      const project = googleProjectNumberFromClientId(process.env.GOOGLE_CLIENT_ID);
      const configured =
        providerId === 'youtube_data_api'
          ? Boolean(process.env.YOUTUBE_API_KEY?.trim())
          : Boolean(process.env.GOOGLE_CLIENT_ID?.trim());
      if (!configured && !project) return null;
      return account({
        email: ONSCEN_OPERATOR_EMAIL,
        name: 'Google Cloud — projet OnScen',
        project,
        source: project ? 'derived' : 'declared',
      });
    }
    case 'apple_signin': {
      const teamId = process.env.APPLE_TEAM_ID?.trim();
      const clientId = process.env.APPLE_CLIENT_ID?.trim();
      if (!teamId && !clientId && !process.env.APPLE_KEY_ID?.trim()) return null;
      return account({
        name: 'Sign in with Apple',
        project: [teamId, clientId].filter(Boolean).join(' · ') || null,
        source: 'derived',
      });
    }
    case 'facebook_instagram': {
      const appId = process.env.FACEBOOK_APP_ID?.trim();
      if (!appId) return null;
      return account({
        name: 'Meta / Facebook Developers',
        project: appId,
        source: 'derived',
      });
    }
    case 'cloudflare_stream': {
      const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
      const subdomain = process.env.CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN?.trim();
      if (!accountId && !process.env.CLOUDFLARE_STREAM_API_TOKEN?.trim()) return null;
      return account({
        name: 'Cloudflare — zone onscen.com',
        project: subdomain ? `${accountId ?? '—'} · ${subdomain}` : accountId ?? null,
        source: 'derived',
      });
    }
    case 'turnstile': {
      if (!process.env.TURNSTILE_SECRET_KEY?.trim()) return null;
      const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
      return account({
        name: 'Cloudflare Turnstile — zone onscen.com',
        project: accountId ?? null,
        source: 'derived',
      });
    }
    case 'livekit': {
      const project = livekitProjectFromUrl(process.env.LIVEKIT_URL);
      if (!project && !process.env.LIVEKIT_API_KEY?.trim()) return null;
      return account({
        email: ONSCEN_OPERATOR_EMAIL,
        name: 'LiveKit Cloud',
        project,
        source: project ? 'derived' : 'declared',
      });
    }
    case 'sightengine': {
      const user = process.env.SIGHTENGINE_API_USER?.trim();
      if (!user) return null;
      return account({
        name: 'Sightengine',
        project: user,
        source: 'derived',
      });
    }
    case 'photodna': {
      if (!process.env.PHOTODNA_SUBSCRIPTION_KEY?.trim()) return null;
      return account({
        name: 'Microsoft PhotoDNA',
        project: 'CSAM hash match',
        source: 'declared',
      });
    }
    case 'acrcloud': {
      const key = process.env.ACRCLOUD_ACCESS_KEY?.trim();
      if (!key) return null;
      return account({
        name: 'ACRCloud',
        project: key,
        source: 'derived',
      });
    }
    case 's3_scaleway': {
      const bucket = process.env.S3_BUCKET?.trim();
      const region = process.env.S3_REGION?.trim();
      if (!bucket && !process.env.S3_ACCESS_KEY_ID?.trim()) return null;
      return account({
        name: 'Scaleway Object Storage',
        project: [bucket, region].filter(Boolean).join(' · ') || null,
        source: 'derived',
      });
    }
    case 'resend_email': {
      if (!process.env.RESEND_API_KEY?.trim() && !process.env.RESEND_FROM?.trim()) return null;
      const fromEmail = parseAngleEmail(process.env.RESEND_FROM);
      return account({
        email: fromEmail,
        name: fromEmail?.endsWith('@resend.dev')
          ? 'Resend — expéditeur sandbox'
          : 'Resend',
        project: process.env.RESEND_FROM?.trim() || null,
        source: fromEmail ? 'derived' : 'declared',
      });
    }
    case 'ai_agents': {
      const anthropic = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
      const openai = Boolean(process.env.OPENAI_API_KEY?.trim());
      if (!anthropic && !openai) return null;
      const names = [
        anthropic ? 'Anthropic' : null,
        openai ? 'OpenAI' : null,
      ].filter(Boolean);
      return account({
        email: ONSCEN_OPERATOR_EMAIL,
        name: names.join(' + '),
        project: names.join(' / '),
        source: 'declared',
      });
    }
    case 'web_push': {
      const subject = parseAngleEmail(process.env.VAPID_SUBJECT) ?? process.env.VAPID_SUBJECT?.trim();
      if (!subject && !process.env.VAPID_PUBLIC_KEY?.trim()) return null;
      return account({
        email: parseAngleEmail(process.env.VAPID_SUBJECT),
        name: 'Web Push (VAPID)',
        project: subject ?? null,
        source: 'derived',
      });
    }
    case 'sentry': {
      if (!process.env.SENTRY_DSN?.trim()) return null;
      return account({
        name: 'Sentry — monitoring erreurs',
        project: 'onscen-backend',
        source: 'declared',
      });
    }
    case 'redis': {
      const raw = process.env.REDIS_URL?.trim();
      if (!raw) return null;
      let project: string | null;
      try {
        project = new URL(raw).host || null;
      } catch {
        project = null;
      }
      return account({
        name: 'Redis (lecture seule)',
        project,
        source: 'derived',
      });
    }
    case 'turn': {
      const user = process.env.TURN_USERNAME?.trim();
      if (!user && !process.env.TURN_URL?.trim()) return null;
      return account({
        name: 'TURN — VPS onscen-prod',
        project: user ?? null,
        source: 'derived',
      });
    }
    default:
      return null;
  }
}

export function resolveStripeAccountSync(): IntegrationAccount | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  const mode = key.startsWith('sk_live_') ? 'live' : key.startsWith('sk_test_') ? 'test' : 'unknown';
  return account({
    email: ONSCEN_OPERATOR_EMAIL,
    name: mode === 'test' ? 'Bewware — Stripe test' : mode === 'live' ? 'Bewware — Stripe live' : 'Stripe',
    project: null,
    source: 'declared',
  });
}

type StripeAccountJson = {
  id?: string;
  email?: string | null;
  business_profile?: { name?: string | null } | null;
  settings?: { dashboard?: { display_name?: string | null } } | null;
};

let stripeAccountCache: { at: number; value: IntegrationAccount | null } | null = null;
const STRIPE_ACCOUNT_TTL_MS = 5 * 60_000;

export function clearStripeAccountCache(): void {
  stripeAccountCache = null;
}

/**
 * Interroge l'API Stripe Account (e-mail + nom) — jamais la clé.
 * Repli synchrone si timeout / erreur.
 */
export async function resolveStripeAccountLive(opts: { timeoutMs?: number } = {}): Promise<IntegrationAccount | null> {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  if (stripeAccountCache && Date.now() - stripeAccountCache.at < STRIPE_ACCOUNT_TTL_MS) {
    return stripeAccountCache.value;
  }

  const fallback = resolveStripeAccountSync();
  const timeoutMs = opts.timeoutMs ?? 4000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch('https://api.stripe.com/v1/account', {
      headers: { Authorization: `Bearer ${key}` },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      stripeAccountCache = { at: Date.now(), value: fallback };
      return fallback;
    }
    const data = (await res.json()) as StripeAccountJson;
    const live = account({
      email: data.email?.trim() || fallback?.email || null,
      name:
        data.business_profile?.name?.trim() ||
        data.settings?.dashboard?.display_name?.trim() ||
        fallback?.name ||
        null,
      project: data.id?.trim() || null,
      source: 'live',
    });
    stripeAccountCache = { at: Date.now(), value: live };
    return live;
  } catch {
    stripeAccountCache = { at: Date.now(), value: fallback };
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}
