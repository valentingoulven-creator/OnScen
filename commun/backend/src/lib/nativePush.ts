import { GoogleAuth } from 'google-auth-library';
import type { AppNotification } from '../models/schema';
import {
  deleteNativePushTokenByToken,
  isNativePushTokensPgEnabled,
  listNativePushTokensForUser,
  type NativePushTokenRecord,
} from './pgNativePushTokens';

/**
 * Notifications push natives (iOS/Android via Firebase Cloud Messaging), distinctes du
 * Web Push (webPush.ts, VAPID/PushManager — ne fonctionne pas dans une WebView Capacitor
 * en arrière-plan/app tuée). Cf. audit mobile : aucune notification native possible sans
 * ce canal, gap critique pour une app social/messagerie.
 *
 * Implémentation : appel HTTP direct à l'API FCM v1 (`google-auth-library` uniquement,
 * pour l'échange du jeton OAuth2 du compte de service) plutôt que le SDK complet
 * `firebase-admin` — celui-ci tire une chaîne de dépendances lourde (@google-cloud/storage,
 * gaxios, teeny-request…) qui est ENTRÉE EN CONFLIT avec la résolution de types de
 * @sentry/node ailleurs dans ce projet (cassait le typecheck de errorMonitoring.ts) et
 * apportait plusieurs vulnérabilités modérées transitives (uuid). google-auth-library seul
 * évite les deux problèmes pour un besoin qui ne nécessite que l'auth + un simple POST JSON.
 *
 * Configuration requise (absente par défaut — no-op tant que non configuré) :
 *   FIREBASE_SERVICE_ACCOUNT_JSON = contenu JSON complet de la clé de compte de service
 *   Firebase (Firebase Console → Paramètres du projet → Comptes de service → Générer une
 *   nouvelle clé privée). Nécessaire pour Android (FCM direct) et iOS (FCM relaie vers
 *   APNs si le projet Firebase est lié à un certificat/clé APNs côté Apple Developer).
 *
 * Cette configuration (créer un projet Firebase, lier APNs, générer google-services.json
 * pour Android) ne peut PAS être faite par un agent de code — nécessite un compte
 * Firebase/Apple Developer réel. Le code ci-dessous est prêt à s'activer dès que ces
 * credentials sont fournis en env, sans aucune autre modification.
 */

const NATIVE_PUSH_TYPES = new Set<AppNotification['type']>([
  'live_started',
  'live_don',
  'salon_invite',
  'salon_created',
  'favorite_online',
  'follow',
  'mention',
  'event_tagged',
  'story_tagged',
  'subscription_payment_failed',
]);

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

let auth: GoogleAuth | null = null;
let projectId: string | null = null;
let configured: boolean | null = null;

function ensureFirebaseConfigured(): boolean {
  if (configured !== null) return configured;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!serviceAccountJson) {
    configured = false;
    return false;
  }

  try {
    const credentials = JSON.parse(serviceAccountJson) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };
    if (!credentials.project_id || !credentials.client_email || !credentials.private_key) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON incomplet (project_id/client_email/private_key requis)');
    }
    projectId = credentials.project_id;
    auth = new GoogleAuth({ credentials, scopes: [FCM_SCOPE] });
    configured = true;
  } catch (err) {
    console.error('[nativePush] FIREBASE_SERVICE_ACCOUNT_JSON invalide :', err);
    configured = false;
  }
  return configured;
}

export function isNativePushConfigured(): boolean {
  return ensureFirebaseConfigured() && isNativePushTokensPgEnabled();
}

function resolveNotificationUrl(n: AppNotification): string {
  if (n.liveId != null) return `/live/${n.liveId}`;
  if (n.salonId != null) return `/salon/${n.salonId}`;
  if (n.postId != null) return `/feed/post/${n.postId}`;
  if (n.reelId != null) return `/reels/${n.reelId}`;
  if (n.peerUserId != null && (n.type === 'follow' || n.type === 'mention')) {
    return `/profile/${n.peerUserId}`;
  }
  return '/';
}

interface FcmSendError {
  error?: { status?: string; message?: string };
}

/** POST /v1/projects/{projectId}/messages:send — lève en cas d'échec (status HTTP dans l'erreur). */
async function sendToToken(device: NativePushTokenRecord, n: AppNotification): Promise<void> {
  if (!auth || !projectId) throw new Error('Firebase non configuré');
  const client = await auth.getClient();
  const accessToken = (await client.getAccessToken()).token;
  if (!accessToken) throw new Error('Impossible d\'obtenir un jeton FCM');

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token: device.token,
          notification: { title: 'Soundy', body: n.message },
          data: {
            url: resolveNotificationUrl(n),
            type: n.type,
            notificationId: n.id,
          },
          apns: { payload: { aps: { sound: 'default' } } },
          android: { priority: 'high' },
        },
      }),
    }
  );

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as FcmSendError;
    const status = body.error?.status;
    const err = new Error(body.error?.message || `FCM send failed (HTTP ${res.status})`) as Error & {
      fcmStatus?: string;
    };
    err.fcmStatus = status;
    throw err;
  }
}

/** Envoie une notification push native si Firebase + tokens PG disponibles. */
export async function sendNativePushForNotification(n: AppNotification): Promise<void> {
  if (!NATIVE_PUSH_TYPES.has(n.type)) return;
  if (!isNativePushConfigured()) return;

  const devices = await listNativePushTokensForUser(n.recipientId);
  if (!devices.length) return;

  await Promise.all(
    devices.map(async (device) => {
      try {
        await sendToToken(device, n);
      } catch (err) {
        const status = (err as { fcmStatus?: string })?.fcmStatus;
        // Token périmé / app désinstallée : nettoyage silencieux, comportement standard FCM.
        if (status === 'NOT_FOUND' || status === 'UNREGISTERED' || status === 'INVALID_ARGUMENT') {
          await deleteNativePushTokenByToken(device.token).catch(() => {});
        } else {
          console.warn('[nativePush] send failed:', err);
        }
      }
    })
  );
}
