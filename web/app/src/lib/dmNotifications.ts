let permissionAsked = false;

export const NOTIFICATIONS_MUTED_LS_KEY = 'soundy_notifications_muted';

function isNotificationsMuted(): boolean {
  try {
    return localStorage.getItem(NOTIFICATIONS_MUTED_LS_KEY) === 'true';
  } catch {
    return false;
  }
}

export function requestDmNotificationPermission(): void {
  if (permissionAsked || typeof Notification === 'undefined') return;
  permissionAsked = true;
  if (Notification.permission === 'default') {
    void Notification.requestPermission();
  }
}

export function showDmSystemNotification(senderName: string, preview: string): void {
  if (isNotificationsMuted()) return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible') return;
  try {
    const body = preview.length > 120 ? `${preview.slice(0, 117)}…` : preview;
    new Notification(`Message de ${senderName}`, { body, tag: 'melosong-dm' });
  } catch {
    /* ignore */
  }
}

export function showMatchSystemNotification(partnerName: string): void {
  if (isNotificationsMuted()) return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible') return;
  try {
    new Notification('Nouveau match musical !', {
      body: `Match avec ${partnerName} 💞`,
      tag: 'melosong-match',
    });
  } catch {
    /* ignore */
  }
}
