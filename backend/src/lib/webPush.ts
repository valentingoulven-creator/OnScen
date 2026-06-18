import webpush from 'web-push';
import type { AppNotification } from '../models/schema';
import {
  deletePushSubscriptionByEndpoint,
  isPushSubscriptionsPgEnabled,
  listPushSubscriptionsForUser,
  type PushSubscriptionRecord,
} from './pgPushSubscriptions';

const WEB_PUSH_TYPES = new Set<AppNotification['type']>([
  'live_started',
  'live_don',
  'salon_invite',
  'favorite_online',
]);

let configured = false;

function ensureWebPushConfigured(): boolean {
  if (configured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:contact@getsoundy.com';
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export function isWebPushConfigured(): boolean {
  return ensureWebPushConfigured() && isPushSubscriptionsPgEnabled();
}

export function getVapidPublicKey(): string | null {
  const key = process.env.VAPID_PUBLIC_KEY?.trim();
  return key || null;
}

function pushPayloadForNotification(n: AppNotification): string {
  const url =
    n.liveId != null
      ? `/live/${n.liveId}`
      : n.salonId != null
        ? `/salon/${n.salonId}`
        : '/';
  return JSON.stringify({
    title: 'Soundy',
    body: n.message,
    url,
    tag: n.id,
    type: n.type,
  });
}

async function sendToSubscription(
  sub: PushSubscriptionRecord,
  payload: string
): Promise<void> {
  await webpush.sendNotification(
    {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth },
    },
    payload
  );
}

/** Envoie une notification Web Push si VAPID + abonnement PG disponibles. */
export async function sendWebPushForNotification(n: AppNotification): Promise<void> {
  if (!WEB_PUSH_TYPES.has(n.type)) return;
  if (!ensureWebPushConfigured() || !isPushSubscriptionsPgEnabled()) return;

  const subs = await listPushSubscriptionsForUser(n.recipientId);
  if (!subs.length) return;

  const payload = pushPayloadForNotification(n);
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await sendToSubscription(sub, payload);
      } catch (err) {
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          await deletePushSubscriptionByEndpoint(sub.endpoint).catch(() => {});
        } else {
          console.warn('[webPush] send failed:', err);
        }
      }
    })
  );
}
