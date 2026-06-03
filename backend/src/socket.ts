import { Server, Socket } from 'socket.io';
import { db, ChatMessage } from './models/schema';
import { markSocketOnline, markSocketOffline } from './lib/presence';
import { shouldDeliverToReceiver } from './lib/blocks';
import { canJoinSalon } from './lib/salonAccess';
import {
  ensureSalonQueue,
  getPendingProposals,
  broadcastSalonPlayback,
} from './lib/salonPlaybackOps';
import {
  canBanLiveUser,
  canDeleteLiveChatMessage,
  deleteLiveChatMessage,
} from './lib/liveModeration';
import {
  getLiveBan,
  isLiveChatBanned,
  isLiveViewBanned,
  liveBanMessage,
  setLiveBan,
} from './lib/liveBans';
import type { LiveBanScope } from './models/schema';
import { isPlatformConnected } from './lib/platformConnect';
import { schedulePersist } from './lib/persist';

export function setupSockets(io: Server): void {
  io.on('connection', (socket: Socket) => {
    socket.on('register', (userId: string) => {
      socket.join(`user_${userId}`);
      (socket.data as { userId?: string }).userId = userId;
      markSocketOnline(socket.id, userId);
      io.emit('presence', { userId, online: true });
    });

    socket.on('disconnect', () => {
      const wentOffline = markSocketOffline(socket.id);
      if (wentOffline) {
        io.emit('presence', { userId: wentOffline, online: false });
      }
    });

    socket.on('join_salon', ({ salonId, userId, username }: { salonId: string; userId: string; username: string }) => {
      const salon = db.salons.get(salonId);
      if (!salon || !canJoinSalon(salon, userId)) {
        socket.emit('salon_join_denied', { salonId });
        return;
      }
      const roomName = `salon_${salonId}`;
      const alreadyIn = socket.rooms.has(roomName);
      socket.join(roomName);
      if (!alreadyIn) {
        salon.listenersCount += 1;
        db.salons.set(salonId, salon);
        io.to(roomName).emit('salon_updated', salon);
      }
      socket.emit('playback_sync', salon.playbackState);
      socket.emit('salon_playback', salon.playbackState);
      socket.emit('salon_queue_updated', { salonId, queue: ensureSalonQueue(salonId) });
      if (userId === salon.hostId) {
        socket.emit('salon_proposals_updated', {
          salonId,
          proposals: getPendingProposals(salonId),
        });
      }
    });

    socket.on('leave_salon', ({ salonId }: { salonId: string }) => {
      socket.leave(`salon_${salonId}`);
      const salon = db.salons.get(salonId);
      if (salon && salon.listenersCount > 0) {
        salon.listenersCount -= 1;
        db.salons.set(salonId, salon);
        io.to(`salon_${salonId}`).emit('salon_updated', salon);
      }
    });

    socket.on('join_live', ({ liveId }: { liveId: string }) => {
      const userId = (socket.data as { userId?: string }).userId;
      if (userId) {
        const ban = getLiveBan(liveId, userId);
        if (ban) {
          socket.emit('live_user_banned', {
            liveId,
            scope: ban.scope,
            permanent: ban.permanent,
            until: ban.until,
            message: liveBanMessage(ban),
          });
          if (ban.scope === 'live') return;
        }
      }
      const roomName = `live_${liveId}`;
      const alreadyIn = socket.rooms.has(roomName);
      socket.join(roomName);
      const live = db.lives.get(liveId);
      if (live && !alreadyIn) {
        live.viewersCount += 1;
        db.lives.set(liveId, live);
        io.to(roomName).emit('live_updated', live);
      }
    });

    socket.on('leave_live', ({ liveId }: { liveId: string }) => {
      socket.leave(`live_${liveId}`);
      const live = db.lives.get(liveId);
      if (live && live.viewersCount > 0) {
        live.viewersCount -= 1;
        db.lives.set(liveId, live);
        io.to(`live_${liveId}`).emit('live_updated', live);
      }
    });

    socket.on('live_camera_toggle', ({ liveId, active }: { liveId: string; active: boolean }) => {
      const userId = (socket.data as { userId?: string }).userId;
      if (!userId || !liveId) return;
      const live = db.lives.get(liveId);
      if (!live || live.hostId !== userId || !live.isActive) return;
      live.cameraActive = !!active;
      db.lives.set(liveId, live);
      io.to(`live_${liveId}`).emit('live_updated', live);
    });

    socket.on(
      'live_set_vip',
      ({ liveId, userId: targetUserId, add }: { liveId: string; userId: string; add: boolean }) => {
        const actorId = (socket.data as { userId?: string }).userId;
        if (!actorId || !liveId || !targetUserId) return;
        const live = db.lives.get(liveId);
        if (!live || !live.isActive || live.hostId !== actorId) return;
        if (targetUserId === live.hostId) return;

        const ids = live.vipModeratorIds ?? [];
        if (add) {
          if (!ids.includes(targetUserId)) ids.push(targetUserId);
        } else {
          live.vipModeratorIds = ids.filter((id) => id !== targetUserId);
          db.lives.set(liveId, live);
          io.to(`live_${liveId}`).emit('live_updated', live);
          return;
        }
        live.vipModeratorIds = ids;
        db.lives.set(liveId, live);
        io.to(`live_${liveId}`).emit('live_updated', live);
      }
    );

    socket.on(
      'live_ban',
      ({
        liveId,
        userId: targetUserId,
        permanent,
        durationMs,
        scope: banScope,
      }: {
        liveId: string;
        userId: string;
        permanent?: boolean;
        durationMs?: number;
        scope?: LiveBanScope;
      }) => {
        const actorId = (socket.data as { userId?: string }).userId;
        if (!actorId || !liveId || !targetUserId) return;
        const live = db.lives.get(liveId);
        if (!live || !live.isActive) return;
        if (!canBanLiveUser(live, actorId, targetUserId)) return;

        const scope: LiveBanScope = banScope === 'chat' ? 'chat' : 'live';
        const isPermanent = !!permanent;
        const ban = {
          scope,
          permanent: isPermanent,
          until: isPermanent ? undefined : Date.now() + Math.max(durationMs ?? 5 * 60 * 1000, 60_000),
          bannedAt: Date.now(),
        };
        setLiveBan(liveId, targetUserId, ban);

        if (scope === 'live') {
          const ids = live.vipModeratorIds ?? [];
          if (ids.includes(targetUserId)) {
            live.vipModeratorIds = ids.filter((id) => id !== targetUserId);
            db.lives.set(liveId, live);
            io.to(`live_${liveId}`).emit('live_updated', live);
          }
        }

        io.to(`user_${targetUserId}`).emit('live_user_banned', {
          liveId,
          scope: ban.scope,
          permanent: ban.permanent,
          until: ban.until,
          message: liveBanMessage(ban),
        });
      }
    );

    socket.on(
      'live_chat_delete',
      ({ liveId, messageId }: { liveId: string; messageId: string }) => {
        const userId = (socket.data as { userId?: string }).userId;
        if (!userId || !liveId || !messageId) return;
        const live = db.lives.get(liveId);
        if (!live || !live.isActive) return;

        const list = db.liveChats.get(liveId);
        const msg = list?.find((m) => m.id === messageId);
        if (!msg) return;

        if (!canDeleteLiveChatMessage(live, userId)) return;
        if (!deleteLiveChatMessage(liveId, messageId)) return;

        io.to(`live_${liveId}`).emit('live_message_deleted', { roomId: liveId, messageId });
      }
    );

    socket.on(
      'salon_message',
      (payload: { salonId: string; senderId: string; senderName: string; content: string }) => {
        const authUserId = (socket.data as { userId?: string }).userId;
        if (!authUserId || authUserId !== payload.senderId) return;
        const msg: ChatMessage = {
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          roomId: payload.salonId,
          roomType: 'salon',
          senderId: authUserId,
          senderName: payload.senderName,
          content: payload.content,
          timestamp: Date.now(),
        };
        const list = db.salonChats.get(payload.salonId) || [];
        list.push(msg);
        db.salonChats.set(payload.salonId, list);
        schedulePersist();
        io.to(`salon_${payload.salonId}`).emit('salon_message', msg);
      }
    );

    socket.on(
      'live_message',
      (payload: { liveId: string; senderId: string; senderName: string; content: string }) => {
        const authUserId = (socket.data as { userId?: string }).userId;
        if (!authUserId || authUserId !== payload.senderId) return;
        if (isLiveChatBanned(payload.liveId, authUserId)) {
          const ban = getLiveBan(payload.liveId, authUserId);
          socket.emit('live_chat_denied', {
            liveId: payload.liveId,
            reason: 'banned',
            message: ban ? liveBanMessage(ban) : 'Vous êtes banni du chat de ce live.',
          });
          return;
        }
        if (isLiveViewBanned(payload.liveId, authUserId)) {
          const ban = getLiveBan(payload.liveId, authUserId);
          socket.emit('live_user_banned', {
            liveId: payload.liveId,
            scope: 'live',
            permanent: ban?.permanent,
            until: ban?.until,
            message: ban ? liveBanMessage(ban) : 'Vous êtes banni de ce live.',
          });
          return;
        }
        const msg: ChatMessage = {
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          roomId: payload.liveId,
          roomType: 'live',
          senderId: authUserId,
          senderName: payload.senderName,
          content: payload.content,
          timestamp: Date.now(),
        };
        const list = db.liveChats.get(payload.liveId) || [];
        list.push(msg);
        db.liveChats.set(payload.liveId, list);
        schedulePersist();
        io.to(`live_${payload.liveId}`).emit('live_message', msg);
      }
    );

    socket.on('dm', (msg: { id: string; senderId: string; receiverId: string; content: string; timestamp?: number }) => {
      const authUserId = (socket.data as { userId?: string }).userId;
      if (!msg?.id || !msg.senderId || !msg.receiverId) return;
      if (!authUserId || authUserId !== msg.senderId) return;
      const full = {
        id: msg.id,
        senderId: msg.senderId,
        receiverId: msg.receiverId,
        content: msg.content,
        timestamp: msg.timestamp ?? Date.now(),
        accepted: true,
      };
      if (shouldDeliverToReceiver(full.senderId, full.receiverId)) {
        io.to(`user_${full.receiverId}`).emit('dm', full);
      }
    });

    socket.on('gift_sent', (gift: { liveId: string; senderName: string; giftType: string; amount: number }) => {
      io.to(`live_${gift.liveId}`).emit('gift_animation', gift);
    });

    socket.on('join_reel', ({ reelId }: { reelId: string }) => {
      if (reelId) socket.join(`reel_${reelId}`);
    });

    socket.on('leave_reel', ({ reelId }: { reelId: string }) => {
      if (reelId) socket.leave(`reel_${reelId}`);
    });

    socket.on('sync_playback', ({ salonId, playbackState }: { salonId: string; playbackState: object }) => {
      const userId = (socket.data as { userId?: string }).userId;
      const salon = db.salons.get(salonId);
      if (!salon || !userId || salon.hostId !== userId) return;
      const hostUser = db.users.get(userId);
      if (!hostUser || !isPlatformConnected(hostUser, salon.platform)) {
        socket.emit('host_playback_denied', {
          salonId,
          code: 'HOST_PLATFORM_NOT_LINKED',
          platform: salon.platform,
        });
        return;
      }

      const now = Date.now();
      const patch = playbackState as Record<string, unknown>;
      const merged = {
        ...salon.playbackState,
        ...patch,
        updatedAt: typeof patch.updatedAt === 'number' ? patch.updatedAt : now,
      } as typeof salon.playbackState;

      if (merged.isPlaying && typeof merged.startedAt !== 'number') {
        merged.startedAt = now;
      }
      if (!merged.isPlaying) {
        merged.startedAt = undefined;
      }

      salon.playbackState = merged;
      db.salons.set(salonId, salon);
      broadcastSalonPlayback(salonId, salon.playbackState);
    });
  });
}
