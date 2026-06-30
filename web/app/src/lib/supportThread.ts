import type { SupportContactMessage, SupportThreadMessage } from '../types';

export function getSupportThread(msg: SupportContactMessage): SupportThreadMessage[] {
  if (msg.thread && msg.thread.length > 0) return msg.thread;
  const thread: SupportThreadMessage[] = [
    {
      id: `${msg.id}_u0`,
      role: 'user',
      body: msg.body,
      createdAt: msg.createdAt,
      authorUserId: msg.fromUserId,
    },
  ];
  if (msg.adminReply && msg.repliedAt) {
    thread.push({
      id: `${msg.id}_a0`,
      role: 'admin',
      body: msg.adminReply,
      createdAt: msg.repliedAt,
      authorUserId: 'admin',
    });
  }
  if (msg.userReply && msg.userRepliedAt) {
    thread.push({
      id: `${msg.id}_u1`,
      role: 'user',
      body: msg.userReply,
      createdAt: msg.userRepliedAt,
      authorUserId: msg.fromUserId,
    });
  }
  return thread;
}

export function getSupportLastPreview(msg: SupportContactMessage): string {
  const thread = getSupportThread(msg);
  const last = thread[thread.length - 1];
  return last?.body ?? msg.body;
}

export function getSupportLastTimestamp(msg: SupportContactMessage): number {
  const thread = getSupportThread(msg);
  const last = thread[thread.length - 1];
  return last?.createdAt ?? msg.createdAt;
}

const SUPPORT_SEEN_KEY = 'soundy_support_seen';

export function getSupportSeenAt(ticketId: string): number {
  try {
    const raw = localStorage.getItem(`${SUPPORT_SEEN_KEY}_${ticketId}`);
    return raw ? Number(raw) : 0;
  } catch {
    return 0;
  }
}

export function markSupportSeen(ticketId: string): void {
  try {
    localStorage.setItem(`${SUPPORT_SEEN_KEY}_${ticketId}`, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function isSupportUnread(msg: SupportContactMessage): boolean {
  if (msg.status !== 'replied') return false;
  const repliedAt = msg.repliedAt ?? getSupportLastTimestamp(msg);
  return repliedAt > getSupportSeenAt(msg.id);
}
