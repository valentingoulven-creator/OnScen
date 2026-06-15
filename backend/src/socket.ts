import { Server, Socket } from 'socket.io';
import { db, ChatMessage, SalonBan } from './models/schema';
import { extractSocketAuthToken, verifyAuthToken } from './middleware/auth';
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
import {
  assertCanJoinLiveAsViewer,
  PlatformPlanError,
} from './lib/platformPlans';
import {
  validateLiveWebrtcSignal,
  validateLiveWebrtcViewerReady,
} from './lib/liveVideoRelay';
import { serializePublicLive } from './lib/livePublic';
import { canUserUseApp, isDevUser } from './lib/accessControl';
import {
  canControlSalonPlayback,
  canModerateSalon,
  canModerateSalonTarget,
  setSalonVipModerator,
} from './lib/salonModeration';

// Debounce presence broadcasts per user: prevents rapid-fire storms when a user
// reconnects multiple times in quick succession (e.g., mobile network hiccup).
const _presenceDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

function broadcastPresence(io: Server, userId: string, online: boolean): void {
  const existing = _presenceDebounceTimers.get(userId);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    _presenceDebounceTimers.delete(userId);
    io.emit('presence', { userId, online });
  }, 150);
  _presenceDebounceTimers.set(userId, timer);
}

function attachAuthenticatedUser(socket: Socket, userId: string): void {
  socket.join(`user_${userId}`);
  (socket.data as { userId?: string }).userId = userId;
  markSocketOnline(socket.id, userId);
}

export function setupSockets(io: Server): void {
  io.use((socket, next) => {
    const token = extractSocketAuthToken(socket.handshake);
    if (!token) {
      next(new Error('auth_required'));
      return;
    }
    const payload = verifyAuthToken(token);
    if (!payload?.id) {
      next(new Error('auth_invalid'));
      return;
    }
    const user = db.users.get(payload.id);
    if (!user || !canUserUseApp(user)) {
      next(new Error('auth_forbidden'));
      return;
    }
    (socket.data as { userId?: string }).userId = payload.id;
    next();
  });

  io.on('connection', (socket: Socket) => {
    const authUserId = (socket.data as { userId?: string }).userId;
    if (authUserId) {
      attachAuthenticatedUser(socket, authUserId);
      broadcastPresence(io, authUserId, true);
    }

    socket.on('register', (userId: string) => {
      if (!userId || typeof userId !== 'string') return;
      const existing = (socket.data as { userId?: string }).userId;
      if (!existing || existing !== userId) return;
      if (!db.users.has(userId)) return;
      attachAuthenticatedUser(socket, userId);
      broadcastPresence(io, userId, true);
    });

    socket.on('disconnect', () => {
      const wentOffline = markSocketOffline(socket.id);
      if (wentOffline) {
        broadcastPresence(io, wentOffline, false);
      }
    });

    socket.on('join_salon', ({ salonId, userId, username }: { salonId: string; userId: string; username: string }) => {
      const salon = db.salons.get(salonId);
      if (!salon || !canJoinSalon(salon, userId)) {
        socket.emit('salon_join_denied', { salonId });
        return;
      }
      if (userId !== salon.hostId) {
        const banMap = db.salonBans.get(salonId);
        const ban = banMap?.get(userId);
        if (ban) {
          const now = Date.now();
          if (ban.permanent || (ban.until != null && ban.until > now)) {
            socket.emit('salon_join_denied', { salonId, reason: 'banned' });
            return;
          }
        }
      }
      const roomName = `salon_${salonId}`;
      const alreadyIn = socket.rooms.has(roomName);
      socket.join(roomName);
      if (!alreadyIn && userId !== salon.hostId) {
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
      const actorId = (socket.data as { userId?: string }).userId;
      const salon = db.salons.get(salonId);
      if (salon && actorId && actorId !== salon.hostId && salon.listenersCount > 0) {
        salon.listenersCount -= 1;
        db.salons.set(salonId, salon);
        io.to(`salon_${salonId}`).emit('salon_updated', salon);
      }
    });

    socket.on(
      'salon_set_vip',
      ({ salonId, userId: targetUserId, add }: { salonId: string; userId: string; add: boolean }) => {
        const actorId = (socket.data as { userId?: string }).userId;
        if (!actorId) return;
        setSalonVipModerator(salonId, actorId, targetUserId, add === true);
      }
    );

    socket.on(
      'salon_kick',
      ({ salonId, userId: targetUserId }: { salonId: string; userId: string }) => {
        const actorId = (socket.data as { userId?: string }).userId;
        if (!actorId || !salonId || !targetUserId) return;
        const salon = db.salons.get(salonId);
        if (!salon) return;

        if (!canModerateSalon(salon, actorId)) return;
        if (!canModerateSalonTarget(salon, actorId, targetUserId)) return;

        io.to(`user_${targetUserId}`).emit('salon_kicked', { salonId });
        void io.in(`user_${targetUserId}`).socketsLeave(`salon_${salonId}`);

        if (salon.listenersCount > 0) {
          salon.listenersCount -= 1;
          db.salons.set(salonId, salon);
          io.to(`salon_${salonId}`).emit('salon_updated', salon);
        }
      }
    );

    socket.on(
      'salon_ban',
      ({
        salonId,
        userId: targetUserId,
        permanent,
        durationMs,
      }: {
        salonId: string;
        userId: string;
        permanent: boolean;
        durationMs?: number;
      }) => {
        const actorId = (socket.data as { userId?: string }).userId;
        if (!actorId || !salonId || !targetUserId) return;
        const salon = db.salons.get(salonId);
        if (!salon) return;

        if (!canModerateSalon(salon, actorId)) return;
        if (!canModerateSalonTarget(salon, actorId, targetUserId)) return;

        const isTargetVip = (salon.vipModeratorIds ?? []).includes(targetUserId);

        let banMap = db.salonBans.get(salonId);
        if (!banMap) {
          banMap = new Map<string, SalonBan>();
          db.salonBans.set(salonId, banMap);
        }
        const ban: SalonBan = {
          permanent: !!permanent,
          until: permanent ? undefined : Date.now() + Math.max(durationMs ?? 5 * 60 * 1000, 60_000),
          bannedAt: Date.now(),
        };
        banMap.set(targetUserId, ban);

        if (isTargetVip) {
          salon.vipModeratorIds = (salon.vipModeratorIds ?? []).filter((id) => id !== targetUserId);
          db.salons.set(salonId, salon);
        }

        io.to(`user_${targetUserId}`).emit('salon_banned', { salonId });
        void io.in(`user_${targetUserId}`).socketsLeave(`salon_${salonId}`);

        const updatedSalon = db.salons.get(salonId) ?? salon;
        if (updatedSalon.listenersCount > 0) {
          updatedSalon.listenersCount -= 1;
          db.salons.set(salonId, updatedSalon);
          io.to(`salon_${salonId}`).emit('salon_updated', updatedSalon);
        }
      }
    );

    socket.on(
      'salon_chat_delete',
      ({ salonId, messageId }: { salonId: string; messageId: string }) => {
        const actorId = (socket.data as { userId?: string }).userId;
        if (!actorId || !salonId || !messageId) return;
        const salon = db.salons.get(salonId);
        if (!salon) return;

        if (!canModerateSalon(salon, actorId)) return;

        const list = db.salonChats.get(salonId);
        if (!list) return;
        const idx = list.findIndex((m) => m.id === messageId);
        if (idx === -1) return;

        list.splice(idx, 1);
        db.salonChats.set(salonId, list);
        io.to(`salon_${salonId}`).emit('salon_message_deleted', { roomId: salonId, messageId });
      }
    );

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
      const live = db.lives.get(liveId);
      if (live && userId && userId !== live.hostId && !alreadyIn) {
        try {
          assertCanJoinLiveAsViewer(live.hostId, live.viewersCount, userId);
        } catch (e) {
          if (e instanceof PlatformPlanError) {
            socket.emit('live_join_denied', {
              liveId,
              message: e.message,
              code: e.code,
            });
            return;
          }
          throw e;
        }
      }
      socket.join(roomName);
      if (live) {
        socket.emit('live_updated', serializePublicLive(live, undefined, userId));
        if (!alreadyIn) {
          live.viewersCount += 1;
          db.lives.set(liveId, live);
          io.to(roomName).emit('live_updated', serializePublicLive(live));
        }
        if (
          userId &&
          userId !== live.hostId &&
          live.cameraActive &&
          live.cameraMode !== 'file'
        ) {
          io.to(`user_${live.hostId}`).emit('live_webrtc_viewer_joined', {
            liveId,
            viewerId: userId,
          });
        }
      }
    });

    socket.on('leave_live', ({ liveId }: { liveId: string }) => {
      const userId = (socket.data as { userId?: string }).userId;
      const roomName = `live_${liveId}`;
      socket.leave(roomName);
      const live = db.lives.get(liveId);
      if (live && live.viewersCount > 0) {
        live.viewersCount -= 1;
        db.lives.set(liveId, live);
        io.to(roomName).emit('live_updated', serializePublicLive(live));
      }
      if (live && userId && userId !== live.hostId) {
        io.to(`user_${live.hostId}`).emit('live_webrtc_viewer_left', { liveId, viewerId: userId });
      }
    });

    socket.on('live_webrtc_viewer_ready', ({ liveId }: { liveId: string }) => {
      const viewerId = (socket.data as { userId?: string }).userId;
      if (!viewerId || !liveId) return;
      const roomName = `live_${liveId}`;
      if (!socket.rooms.has(roomName)) return;
      const live = db.lives.get(liveId);
      if (!validateLiveWebrtcViewerReady(live, viewerId, true)) return;
      io.to(`user_${live!.hostId}`).emit('live_webrtc_viewer_joined', { liveId, viewerId });
    });

    socket.on(
      'live_webrtc_signal',
      ({
        liveId,
        toUserId,
        type,
        data,
      }: {
        liveId: string;
        toUserId: string;
        type: 'offer' | 'answer' | 'ice';
        data: Record<string, unknown>;
      }) => {
        const senderId = (socket.data as { userId?: string }).userId;
        if (!senderId || !liveId || !toUserId || !type || !data) return;
        const roomName = `live_${liveId}`;
        if (!socket.rooms.has(roomName)) return;
        const live = db.lives.get(liveId);
        if (!validateLiveWebrtcSignal(live, senderId, toUserId, type, true)) return;
        io.to(`user_${toUserId}`).emit('live_webrtc_signal', {
          liveId,
          fromUserId: senderId,
          toUserId,
          type,
          data,
        });
      }
    );

    socket.on(
      'live_camera_toggle',
      ({
        liveId,
        active,
        mode,
      }: {
        liveId: string;
        active: boolean;
        mode?: 'camera' | 'file';
      }) => {
        const userId = (socket.data as { userId?: string }).userId;
        if (!userId || !liveId) return;
        const live = db.lives.get(liveId);
        if (!live || live.hostId !== userId || !live.isActive) return;
        live.cameraActive = !!active;
        if (active && (mode === 'camera' || mode === 'file')) {
          live.cameraMode = mode;
        } else if (!active) {
          live.cameraMode = undefined;
        }
        db.lives.set(liveId, live);
        io.to(`live_${liveId}`).emit('live_updated', serializePublicLive(live));
        if (active && mode === 'camera') {
          const roomName = `live_${liveId}`;
          const room = io.sockets.adapter.rooms.get(roomName);
          if (room) {
            for (const socketId of room) {
              const viewerSocket = io.sockets.sockets.get(socketId);
              const viewerId = (viewerSocket?.data as { userId?: string }).userId;
              if (viewerId && viewerId !== live.hostId) {
                io.to(`user_${live.hostId}`).emit('live_webrtc_viewer_joined', {
                  liveId,
                  viewerId,
                });
              }
            }
          }
        }
      }
    );

    socket.on(
      'live_set_vip',
      ({ liveId, userId: targetUserId, add }: { liveId: string; userId: string; add: boolean }) => {
        const actorId = (socket.data as { userId?: string }).userId;
        if (!actorId || !liveId || !targetUserId) return;
        const live = db.lives.get(liveId);
        if (!live || !live.isActive) return;
        const actor = db.users.get(actorId);
        if (live.hostId !== actorId && !isDevUser(actor)) return;
        if (targetUserId === live.hostId) return;

        const ids = live.vipModeratorIds ?? [];
        if (add) {
          if (!ids.includes(targetUserId)) ids.push(targetUserId);
        } else {
          live.vipModeratorIds = ids.filter((id) => id !== targetUserId);
          db.lives.set(liveId, live);
          io.to(`live_${liveId}`).emit('live_updated', serializePublicLive(live));
          return;
        }
        live.vipModeratorIds = ids;
        db.lives.set(liveId, live);
        io.to(`live_${liveId}`).emit('live_updated', serializePublicLive(live));
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
            io.to(`live_${liveId}`).emit('live_updated', serializePublicLive(live));
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
      (payload: {
        salonId: string;
        senderId: string;
        senderName: string;
        content: string;
        attachmentUrl?: string;
        attachmentName?: string;
        attachmentSize?: number;
        attachmentMimeType?: string;
      }) => {
        const authUserId = (socket.data as { userId?: string }).userId;
        if (!authUserId || authUserId !== payload.senderId) return;
        // Require the sender to be in the salon room (prevents non-members flooding the chat).
        if (!socket.rooms.has(`salon_${payload.salonId}`)) return;
        // Limit message content length to avoid storing oversized data.
        const content = typeof payload.content === 'string' ? payload.content.slice(0, 2000) : '';
        if (!content.trim() && !payload.attachmentUrl) return;
        const sender = db.users.get(authUserId);
        const msg: ChatMessage = {
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          roomId: payload.salonId,
          roomType: 'salon',
          senderId: authUserId,
          senderName: payload.senderName,
          senderUsernameColor: sender?.usernameColor,
          senderUsernameWaveFrom: sender?.usernameWaveFrom,
          senderUsernameWaveTo: sender?.usernameWaveTo,
          senderIsDev: isDevUser(sender) ? true : undefined,
          content,
          timestamp: Date.now(),
          ...(payload.attachmentUrl ? {
            attachmentUrl: payload.attachmentUrl,
            attachmentName: payload.attachmentName,
            attachmentSize: payload.attachmentSize,
            attachmentMimeType: payload.attachmentMimeType,
          } : {}),
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
      (payload: {
        liveId: string;
        senderId: string;
        senderName: string;
        content: string;
        attachmentUrl?: string;
        attachmentName?: string;
        attachmentSize?: number;
        attachmentMimeType?: string;
      }) => {
        const authUserId = (socket.data as { userId?: string }).userId;
        if (!authUserId || authUserId !== payload.senderId) return;
        // Require the sender to be in the live room (prevents non-members flooding the chat).
        if (!socket.rooms.has(`live_${payload.liveId}`)) return;
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
        const liveContent = typeof payload.content === 'string' ? payload.content.slice(0, 2000) : '';
        if (!liveContent.trim() && !payload.attachmentUrl) return;
        const liveSender = db.users.get(authUserId);
        const msg: ChatMessage = {
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          roomId: payload.liveId,
          roomType: 'live',
          senderId: authUserId,
          senderName: payload.senderName,
          senderUsernameColor: liveSender?.usernameColor,
          senderUsernameWaveFrom: liveSender?.usernameWaveFrom,
          senderUsernameWaveTo: liveSender?.usernameWaveTo,
          senderIsDev: isDevUser(liveSender) ? true : undefined,
          content: liveContent,
          timestamp: Date.now(),
          ...(payload.attachmentUrl ? {
            attachmentUrl: payload.attachmentUrl,
            attachmentName: payload.attachmentName,
            attachmentSize: payload.attachmentSize,
            attachmentMimeType: payload.attachmentMimeType,
          } : {}),
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
      const authUserId = (socket.data as { userId?: string }).userId;
      if (!authUserId || !gift?.liveId) return;
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
      if (!salon || !userId || !canControlSalonPlayback(salon, userId)) return;
      const hostUser = db.users.get(salon.hostId);
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
      const clockTouched =
        'progressMs' in patch ||
        'startedAt' in patch ||
        'isPlaying' in patch ||
        'updatedAt' in patch ||
        'trackId' in patch;

      const merged = {
        ...salon.playbackState,
        ...patch,
      } as typeof salon.playbackState;

      if (clockTouched) {
        merged.updatedAt =
          typeof patch.updatedAt === 'number' ? (patch.updatedAt as number) : now;
        if (merged.isPlaying && typeof merged.startedAt !== 'number') {
          merged.startedAt = now;
        }
        if (!merged.isPlaying) {
          merged.startedAt = undefined;
        }
      }

      const isMsdev =
        process.env.APP_ENV === 'msdev' || process.env.MSENV === 'msdev';
      if (!isMsdev && salon.platform === 'youtube') {
        merged.showVideo = true;
      }

      salon.playbackState = merged;
      db.salons.set(salonId, salon);
      broadcastSalonPlayback(salonId, salon.playbackState);
    });
  });
}
