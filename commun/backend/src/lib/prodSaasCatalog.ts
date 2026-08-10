/**
 * Catalogue SaaS / infra OnScen — montants indicatifs et liens dashboards.
 * Réf. docs/COUT-APPLICATION.md · docs/INFRA-ONSCEN.md
 */

export type ProdSaasCategory = 'infra' | 'streaming' | 'moderation' | 'payments' | 'auth' | 'comms' | 'optional';

export interface ProdSaasCatalogEntry {
  id: string;
  category: ProdSaasCategory;
  /** Obligatoire au démarrage prod (productionStartup). */
  requiredInProd: boolean;
  indicativeCost: string;
  note?: string;
  dashboardUrl?: string;
  docsUrl?: string;
}

export interface ProdSaasExternalLink {
  label: string;
  url: string;
  note?: string;
}

export interface ProdSaasLinkGroup {
  id: string;
  links: ProdSaasExternalLink[];
}

export const PROD_SAAS_CATALOG: ProdSaasCatalogEntry[] = [
  {
    id: 'scaleway_vps',
    category: 'infra',
    requiredInProd: true,
    indicativeCost: '~8–12 €/mo',
    note: 'DEV1-S · Paris fr-par-2 · Node, Caddy, PM2, Coturn',
    dashboardUrl: 'https://console.scaleway.com/instance/servers',
    docsUrl: 'https://www.scaleway.com/en/docs/',
  },
  {
    id: 'scaleway_pg',
    category: 'infra',
    requiredInProd: true,
    indicativeCost: '~15 €/mo',
    note: 'DB-DEV-S · onscen-prod · Paris',
    dashboardUrl: 'https://console.scaleway.com/rdb/instances',
    docsUrl: 'https://www.scaleway.com/en/docs/managed-databases/postgresql-and-mysql/',
  },
  {
    id: 'scaleway_object_storage',
    category: 'infra',
    requiredInProd: false,
    indicativeCost: '~0,80–2 €/mo',
    note: 'Backups off-site SCW_BUCKET (optionnel)',
    dashboardUrl: 'https://console.scaleway.com/object-storage/buckets',
    docsUrl: 'https://www.scaleway.com/en/docs/object-storage/',
  },
  {
    id: 'gmail_workspace',
    category: 'comms',
    requiredInProd: false,
    indicativeCost: '16,90 €/mo',
    note: '@getsoundy.com — Google Workspace',
    dashboardUrl: 'https://admin.google.com',
    docsUrl: 'https://workspace.google.com/pricing',
  },
  {
    id: 'cloudflare_stream',
    category: 'streaming',
    requiredInProd: false,
    indicativeCost: '0 € fixe · ~1 $/1000 min',
    note: 'RTMP → HLS · pay-as-you-go',
    dashboardUrl: 'https://dash.cloudflare.com/?to=/:account/stream/live_inputs',
    docsUrl: 'https://developers.cloudflare.com/stream/pricing/',
  },
  {
    id: 'livekit',
    category: 'streaming',
    requiredInProd: false,
    indicativeCost: '0 $ (Build) · Ship ~50 $/mo',
    note: 'WebRTC SFU · caméra navigateur',
    dashboardUrl: 'https://cloud.livekit.io',
    docsUrl: 'https://livekit.io/pricing',
  },
  {
    id: 'sightengine',
    category: 'moderation',
    requiredInProd: true,
    indicativeCost: '~29 $/mo + usage',
    note: 'Modération NSFW images/vidéos',
    dashboardUrl: 'https://sightengine.com/dashboard',
    docsUrl: 'https://sightengine.com/pricing',
  },
  {
    id: 'acrcloud',
    category: 'moderation',
    requiredInProd: false,
    indicativeCost: 'Forfait + ~0,003–0,01 $/req',
    note: 'Scan copyright uploads audio/vidéo',
    dashboardUrl: 'https://console.acrcloud.com',
    docsUrl: 'https://www.acrcloud.com/pricing/',
  },
  {
    id: 'stripe',
    category: 'payments',
    requiredInProd: false,
    indicativeCost: '1,4 % + 0,25 € / tx',
    note: 'Dons live · Connect · abonnements',
    dashboardUrl: 'https://dashboard.stripe.com',
    docsUrl: 'https://stripe.com/fr/pricing',
  },
  {
    id: 'resend',
    category: 'comms',
    requiredInProd: false,
    indicativeCost: 'Gratuit ~3k/mo · puis ~20 $/mo',
    note: 'E-mails transactionnels prod',
    dashboardUrl: 'https://resend.com/emails',
    docsUrl: 'https://resend.com/pricing',
  },
  {
    id: 'google_oauth',
    category: 'auth',
    requiredInProd: false,
    indicativeCost: '0 €',
    note: 'Connexion Google (OAuth2)',
    dashboardUrl: 'https://console.cloud.google.com/apis/credentials',
    docsUrl: 'https://developers.google.com/identity/protocols/oauth2',
  },
  {
    id: 'youtube_oauth',
    category: 'auth',
    requiredInProd: false,
    indicativeCost: '0 €',
    note: 'OAuth YouTube · playlists salon',
    dashboardUrl: 'https://console.cloud.google.com/apis/credentials',
    docsUrl: 'https://developers.google.com/youtube/v3/getting-started',
  },
  {
    id: 'youtube_api_key',
    category: 'auth',
    requiredInProd: false,
    indicativeCost: '0 € (quota API)',
    note: 'YouTube Data API v3 · recherche serveur',
    dashboardUrl: 'https://console.cloud.google.com/apis/library/youtube.googleapis.com',
    docsUrl: 'https://developers.google.com/youtube/v3/getting-started',
  },
  {
    id: 'coturn',
    category: 'streaming',
    requiredInProd: false,
    indicativeCost: '0 € (inclus VPS)',
    note: 'TURN WebRTC mesh fallback · port 3478',
    docsUrl: 'https://github.com/coturn/coturn',
  },
  {
    id: 's3_uploads',
    category: 'infra',
    requiredInProd: false,
    indicativeCost: '~1–2 €/mo',
    note: 'Uploads médias Scaleway Object Storage',
    dashboardUrl: 'https://console.scaleway.com/object-storage/buckets',
  },
  {
    id: 'redis',
    category: 'optional',
    requiredInProd: false,
    indicativeCost: 'Variable · ~10 €/mo',
    note: 'Socket.io cluster · rate limits (scaling)',
    dashboardUrl: 'https://console.scaleway.com/managed-databases/redis',
    docsUrl: 'https://redis.io/pricing/',
  },
  {
    id: 'web_push',
    category: 'optional',
    requiredInProd: false,
    indicativeCost: '0 €',
    note: 'Notifications push VAPID + PG',
    docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/API/Push_API',
  },
  {
    id: 'anthropic',
    category: 'optional',
    requiredInProd: false,
    indicativeCost: 'Usage API (Agents IA admin)',
    note: 'CEO IA / Dev IA — optionnel',
    dashboardUrl: 'https://console.anthropic.com/settings/billing',
    docsUrl: 'https://www.anthropic.com/pricing',
  },
  {
    id: 'openai',
    category: 'optional',
    requiredInProd: false,
    indicativeCost: 'Usage API',
    note: 'Agents IA admin (fallback)',
    dashboardUrl: 'https://platform.openai.com',
    docsUrl: 'https://openai.com/api/pricing',
  },
  {
    id: 'sentry',
    category: 'optional',
    requiredInProd: false,
    indicativeCost: 'Gratuit tier / usage',
    note: 'Monitoring erreurs backend',
    dashboardUrl: 'https://sentry.io',
    docsUrl: 'https://sentry.io/pricing',
  },
  {
    id: 'legal_publisher',
    category: 'infra',
    requiredInProd: true,
    indicativeCost: '0 €',
    note: 'LCEN art. 6 — legal-publisher.json / .env',
    docsUrl: 'https://www.service-public.fr/professionnels-entreprises/vosdroits/F31228',
  },
  {
    id: 'geo_apis',
    category: 'optional',
    requiredInProd: false,
    indicativeCost: '0 €',
    note: 'geo.api.gouv.fr + Nominatim OSM',
    docsUrl: 'https://geo.api.gouv.fr/decoupage-administratif',
  },
];

export const PROD_SAAS_LINK_GROUPS: ProdSaasLinkGroup[] = [
  {
    id: 'onscen',
    links: [
      { label: 'OnScen prod', url: 'https://getsoundy.com' },
      { label: 'OnScen staging', url: 'https://staging.getsoundy.com' },
      { label: 'Health prod', url: 'https://getsoundy.com/health' },
      { label: 'Health staging', url: 'http://51.159.170.181/health', note: 'IP directe' },
    ],
  },
  {
    id: 'infra',
    links: [
      { label: 'Scaleway Console', url: 'https://console.scaleway.com' },
      { label: 'Scaleway Instances', url: 'https://console.scaleway.com/instance/servers' },
      { label: 'Scaleway PostgreSQL', url: 'https://console.scaleway.com/rdb/instances' },
      { label: 'Scaleway Object Storage', url: 'https://console.scaleway.com/object-storage/buckets' },
      { label: 'Domaine getsoundy.com', url: 'https://www.ovh.com/manager/', note: 'Registrar OVH' },
    ],
  },
  {
    id: 'streaming',
    links: [
      { label: 'Cloudflare Dashboard', url: 'https://dash.cloudflare.com' },
      { label: 'Cloudflare Stream', url: 'https://dash.cloudflare.com/?to=/:account/stream' },
      { label: 'Cloudflare API tokens', url: 'https://dash.cloudflare.com/profile/api-tokens' },
      { label: 'Cloudflare Stream pricing', url: 'https://developers.cloudflare.com/stream/pricing/' },
      { label: 'LiveKit Cloud', url: 'https://cloud.livekit.io' },
      { label: 'LiveKit pricing', url: 'https://livekit.io/pricing' },
    ],
  },
  {
    id: 'payments',
    links: [
      { label: 'Stripe Dashboard', url: 'https://dashboard.stripe.com' },
      { label: 'Stripe Connect', url: 'https://dashboard.stripe.com/connect/accounts/overview' },
      { label: 'Stripe pricing', url: 'https://stripe.com/fr/pricing' },
      { label: 'Stripe DPA', url: 'https://stripe.com/legal/dpa' },
    ],
  },
  {
    id: 'moderation',
    links: [
      { label: 'Sightengine Dashboard', url: 'https://sightengine.com/dashboard' },
      { label: 'Sightengine pricing', url: 'https://sightengine.com/pricing' },
      { label: 'ACRCloud Console', url: 'https://console.acrcloud.com' },
      { label: 'ACRCloud pricing', url: 'https://www.acrcloud.com/pricing/' },
    ],
  },
  {
    id: 'auth',
    links: [
      { label: 'Google Cloud Console', url: 'https://console.cloud.google.com' },
      { label: 'Google OAuth credentials', url: 'https://console.cloud.google.com/apis/credentials' },
      { label: 'YouTube Data API', url: 'https://console.cloud.google.com/apis/library/youtube.googleapis.com' },
      { label: 'YouTube API Terms', url: 'https://developers.google.com/youtube/terms/api-services-terms-of-service' },
    ],
  },
  {
    id: 'comms',
    links: [
      { label: 'Resend Dashboard', url: 'https://resend.com/emails' },
      { label: 'Resend pricing', url: 'https://resend.com/pricing' },
      { label: 'Resend DPA', url: 'https://resend.com/legal/dpa' },
      { label: 'Google Workspace Admin', url: 'https://admin.google.com' },
      { label: 'Google Workspace pricing', url: 'https://workspace.google.com/pricing' },
    ],
  },
  {
    id: 'maps_media',
    links: [
      { label: 'OpenStreetMap', url: 'https://www.openstreetmap.org' },
      { label: 'Nominatim (OSM geocoding)', url: 'https://nominatim.openstreetmap.org' },
      { label: 'geo.api.gouv.fr', url: 'https://geo.api.gouv.fr' },
      { label: 'CARTO basemaps', url: 'https://carto.com/basemaps' },
      { label: 'Esri World Imagery', url: 'https://www.esri.com' },
      { label: 'DiceBear avatars', url: 'https://www.dicebear.com' },
      { label: 'Google STUN (WebRTC)', url: 'https://developers.google.com/stunturn' },
    ],
  },
  {
    id: 'ai',
    links: [
      { label: 'Anthropic Console', url: 'https://console.anthropic.com' },
      { label: 'Anthropic billing', url: 'https://console.anthropic.com/settings/billing' },
      { label: 'Anthropic pricing', url: 'https://www.anthropic.com/pricing' },
      { label: 'OpenAI Platform', url: 'https://platform.openai.com' },
    ],
  },
  {
    id: 'legal',
    links: [
      { label: 'Cloudflare DPA', url: 'https://www.cloudflare.com/cloudflare-customer-dpa/' },
      { label: 'Scaleway confidentialité', url: 'https://www.scaleway.com/fr/politique-de-confidentialite/' },
      { label: 'Google Cloud DPA', url: 'https://cloud.google.com/terms/data-processing-addendum' },
      { label: 'GitHub Actions (CI)', url: 'https://github.com/features/actions' },
      { label: 'Staging DNS (OVH)', url: 'https://www.ovh.com/manager/', note: 'A staging.getsoundy.com -> 51.159.170.181' },
      { label: 'ACRCloud signup', url: 'https://www.acrcloud.com/' },
      { label: 'Sightengine DPA', url: 'https://sightengine.com/privacy' },
    ],
  },
];
