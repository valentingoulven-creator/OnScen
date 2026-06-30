import { db, type SupportContactMessage } from '../models/schema';
import { isAccessAdmin } from './accessControl';
import { getIo } from './ioInstance';

export type PublicSupportContactMessage = {
  id: string;
  fromUserId: string;
  fromUsername: string;
  body: string;
  createdAt: number;
  status: SupportContactMessage['status'];
  adminReply?: string;
  repliedAt?: number;
  userReply?: string;
  userRepliedAt?: number;
  threadId: string;
  thread: NonNullable<SupportContactMessage['thread']>;
};

function buildThread(msg: SupportContactMessage): NonNullable<SupportContactMessage['thread']> {
  if (msg.thread && msg.thread.length > 0) return msg.thread;
  const thread: NonNullable<SupportContactMessage['thread']> = [
    {
      id: `${msg.id}_u0`,
      role: 'user',
      body: msg.body,
      createdAt: msg.createdAt,
      authorUserId: msg.fromUserId,
    },
  ];
  if (msg.adminReply && msg.repliedAt && msg.repliedByUserId) {
    thread.push({
      id: `${msg.id}_a0`,
      role: 'admin',
      body: msg.adminReply,
      createdAt: msg.repliedAt,
      authorUserId: msg.repliedByUserId,
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

export function mapPublicSupportMessage(msg: SupportContactMessage): PublicSupportContactMessage {
  const fromUser = db.users.get(msg.fromUserId);
  const thread = buildThread(msg);
  return {
    id: msg.id,
    fromUserId: msg.fromUserId,
    fromUsername: fromUser?.username ?? '—',
    body: msg.body,
    createdAt: msg.createdAt,
    status: msg.status,
    adminReply: msg.adminReply,
    repliedAt: msg.repliedAt,
    userReply: msg.userReply,
    userRepliedAt: msg.userRepliedAt,
    threadId: msg.threadId ?? msg.id,
    thread,
  };
}

export function broadcastSupportTicketUpdated(msg: SupportContactMessage): void {
  const io = getIo();
  if (!io) return;

  const payload = { message: mapPublicSupportMessage(msg) };
  io.to(`support_ticket_${msg.id}`).emit('support_ticket_updated', payload);
  io.to(`user_${msg.fromUserId}`).emit('support_ticket_updated', payload);

  for (const admin of db.users.values()) {
    if (!isAccessAdmin(admin)) continue;
    io.to(`user_${admin.id}`).emit('support_ticket_updated', payload);
  }
}
