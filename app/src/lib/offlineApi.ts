import { MUSIC_REELS } from '../content/reels';
import type { MusicReel } from '../content/reels';
import type { User } from '../types';
import { OFFLINE_DEMO_TOKEN, OFFLINE_DEMO_USER } from './offlineDemo';
import {
  cloneSalon,
  offlineBlockedIds,
  offlineContacts,
  offlineConversations,
  offlineDirectMessages,
  offlineFollowingIds,
  offlineHostRatings,
  offlineLiveChats,
  offlineLives,
  offlineMatches,
  offlineNotifications,
  offlineOnlineIds,
  offlinePeople,
  offlineProposals,
  offlineQueues,
  offlineReelComments,
  offlineReelHearts,
  offlineReelShares,
  offlineReelViews,
  offlineSalonChats,
  offlineSalons,
  offlineUsers,
} from './offlineDemoData';

const delay = () => new Promise((r) => setTimeout(r, 80));

function parseBody<T>(opts: RequestInit): T {
  if (!opts.body || typeof opts.body !== 'string') return {} as T;
  try {
    return JSON.parse(opts.body) as T;
  } catch {
    return {} as T;
  }
}

function currentUser(): User {
  return { ...offlineUsers[OFFLINE_DEMO_USER.id] };
}

export async function offlineRequest<T>(path: string, opts: RequestInit = {}): Promise<T> {
  await delay();
  const method = (opts.method || 'GET').toUpperCase();
  const clean = path.split('?')[0];

  if (method === 'POST' && clean === '/auth/login') {
    return { token: OFFLINE_DEMO_TOKEN, user: currentUser() } as T;
  }
  if (method === 'POST' && clean === '/auth/register') {
    const body = parseBody<{ username: string; email: string }>(opts);
    const user = { ...currentUser(), username: body.username || currentUser().username, email: body.email };
    offlineUsers[OFFLINE_DEMO_USER.id] = user;
    return { token: OFFLINE_DEMO_TOKEN, user } as T;
  }
  if (method === 'GET' && clean === '/auth/me') {
    return { user: currentUser() } as T;
  }
  if (method === 'PATCH' && clean === '/auth/profile') {
    const body = parseBody<Partial<User>>(opts);
    offlineUsers[OFFLINE_DEMO_USER.id] = { ...currentUser(), ...body };
    return { user: currentUser() } as T;
  }
  if (method === 'PATCH' && clean === '/auth/ghost-mode') {
    const body = parseBody<{ isGhostMode: boolean }>(opts);
    offlineUsers[OFFLINE_DEMO_USER.id] = { ...currentUser(), isGhostMode: body.isGhostMode };
    return { isGhostMode: body.isGhostMode } as T;
  }
  if (method === 'GET' && clean.startsWith('/auth/profile/')) {
    const userId = clean.split('/').pop()!;
    const user = offlineUsers[userId];
    if (!user) throw new Error('Utilisateur introuvable');
    return {
      user: {
        ...user,
        isFollowing: offlineFollowingIds.has(userId),
        hostRating: offlineHostRatings[userId],
      },
    } as T;
  }

  if (method === 'POST' && clean === '/geo/update') {
    const body = parseBody<{ latitude: number; longitude: number }>(opts);
    return {
      blurredLatitude: body.latitude,
      blurredLongitude: body.longitude,
    } as T;
  }
  if (method === 'GET' && clean === '/geo/nearby') {
    return {
      salons: offlineSalons.map(cloneSalon),
      lives: offlineLives.map((l) => ({ ...l, playbackState: { ...l.playbackState } })),
      people: [...offlinePeople],
    } as T;
  }

  const salonMatch = clean.match(/^\/salons\/([^/]+)$/);
  if (method === 'GET' && salonMatch) {
    const salon = offlineSalons.find((s) => s.id === salonMatch[1]);
    if (!salon) throw new Error('Salon introuvable');
    return { salon: cloneSalon(salon) } as T;
  }
  const joinMatch = clean.match(/^\/salons\/([^/]+)\/join$/);
  if (method === 'POST' && joinMatch) {
    const salon = offlineSalons.find((s) => s.id === joinMatch[1]);
    if (!salon) throw new Error('Salon introuvable');
    return { ok: true, salon: cloneSalon(salon) } as T;
  }
  const settingsMatch = clean.match(/^\/salons\/([^/]+)\/settings$/);
  if (method === 'PATCH' && settingsMatch) {
    const salon = offlineSalons.find((s) => s.id === settingsMatch[1]);
    if (!salon) throw new Error('Salon introuvable');
    const body = parseBody<{ accessMode?: 'public' | 'invite' }>(opts);
    if (body.accessMode) salon.accessMode = body.accessMode;
    return { salon: cloneSalon(salon) } as T;
  }
  if (method === 'POST' && clean === '/salons') {
    const body = parseBody<{ title: string; platform: 'spotify' | 'youtube'; latitude: number; longitude: number }>(opts);
    const salon = cloneSalon({
      id: `salon_${Date.now()}`,
      hostId: OFFLINE_DEMO_USER.id,
      hostName: currentUser().username,
      hostAvatarUrl: currentUser().avatarUrl,
      title: body.title || 'Nouveau salon',
      platform: body.platform || 'spotify',
      playbackState: {
        platform: body.platform || 'spotify',
        trackId: 'demo',
        title: 'Mode démo',
        artist: 'MeloSong',
        isPlaying: false,
        progressMs: 0,
        updatedAt: Date.now(),
      },
      latitude: body.latitude ?? 48.8566,
      longitude: body.longitude ?? 2.3522,
      listenersCount: 1,
      isPublic: true,
      accessMode: 'public',
      allowQueue: true,
      canJoin: true,
      isHost: true,
    });
    offlineSalons.push(salon);
    return { salon } as T;
  }

  const queueMatch = clean.match(/^\/salons\/([^/]+)\/queue$/);
  if (method === 'GET' && queueMatch) {
    return { queue: [...(offlineQueues[queueMatch[1]] || [])] } as T;
  }
  const proposalsMatch = clean.match(/^\/salons\/([^/]+)\/proposals$/);
  if (method === 'GET' && proposalsMatch) {
    return { proposals: [...(offlineProposals[proposalsMatch[1]] || [])] } as T;
  }
  if (method === 'POST' && proposalsMatch) {
    const body = parseBody<{ title: string; artist: string }>(opts);
    const proposal = {
      id: `prop_${Date.now()}`,
      salonId: proposalsMatch[1],
      proposerId: OFFLINE_DEMO_USER.id,
      proposerName: currentUser().username,
      title: body.title,
      artist: body.artist,
      status: 'pending' as const,
      createdAt: Date.now(),
    };
    offlineProposals[proposalsMatch[1]] = [...(offlineProposals[proposalsMatch[1]] || []), proposal];
    return { proposal } as T;
  }

  const resolveMatch = clean.match(/^\/salons\/([^/]+)\/resolve-track$/);
  if (method === 'GET' && resolveMatch) {
    const salon = offlineSalons.find((s) => s.id === resolveMatch[1]);
    const ps = salon?.playbackState;
    return {
      track: {
        platform: ps?.platform || 'spotify',
        title: ps?.title || 'Demo',
        artist: ps?.artist || 'MeloSong',
        trackId: ps?.trackId,
        externalUrl: ps?.externalUrl || 'https://open.spotify.com',
        searchUrl: 'https://open.spotify.com/search/demo',
        matchType: 'mock' as const,
        hostPlatform: salon?.platform || 'spotify',
        playbackPositionMs: ps?.progressMs || 0,
      },
    } as T;
  }

  if (method === 'GET' && clean === '/lives') {
    return { lives: offlineLives.map((l) => ({ ...l })) } as T;
  }
  const liveMatch = clean.match(/^\/lives\/([^/]+)$/);
  if (method === 'GET' && liveMatch) {
    const live = offlineLives.find((l) => l.id === liveMatch[1]);
    if (!live) throw new Error('Live introuvable');
    return { live: { ...live, playbackState: { ...live.playbackState } } } as T;
  }
  if (method === 'POST' && clean === '/lives/start') {
    const body = parseBody<{ title?: string; latitude?: number; longitude?: number }>(opts);
    const live = {
      id: `live_${Date.now()}`,
      hostId: OFFLINE_DEMO_USER.id,
      hostName: currentUser().username,
      title: body.title || `Live — ${currentUser().username}`,
      platform: 'spotify' as const,
      playbackState: {
        platform: 'spotify' as const,
        trackId: 'live_demo',
        title: 'Session live démo',
        artist: currentUser().username,
        isPlaying: true,
        progressMs: 0,
        updatedAt: Date.now(),
        startedAt: Date.now(),
      },
      latitude: body.latitude ?? 48.8566,
      longitude: body.longitude ?? 2.3522,
      viewersCount: 1,
      isActive: true,
    };
    offlineLives.unshift(live);
    offlineLiveChats[live.id] = [];
    return { live } as T;
  }
  if (method === 'POST' && clean === '/lives/stop') {
    return { ok: true } as T;
  }

  const salonChatMatch = clean.match(/^\/chat\/salon\/([^/]+)$/);
  if (method === 'GET' && salonChatMatch) {
    return { messages: [...(offlineSalonChats[salonChatMatch[1]] || [])] } as T;
  }
  const liveChatMatch = clean.match(/^\/chat\/live\/([^/]+)$/);
  if (method === 'GET' && liveChatMatch) {
    return { messages: [...(offlineLiveChats[liveChatMatch[1]] || [])] } as T;
  }

  if (method === 'GET' && clean === '/dm/presence') {
    return { onlineUserIds: [...offlineOnlineIds] } as T;
  }
  if (method === 'GET' && clean === '/dm/conversations/list') {
    return { conversations: [...offlineConversations] } as T;
  }
  if (method === 'GET' && clean === '/dm/contacts/list') {
    return {
      contacts: offlineContacts.filter((c) => !offlineBlockedIds.has(c.id)),
    } as T;
  }
  if (method === 'GET' && clean === '/dm/blocks/list') {
    return {
      blocked: offlineContacts.filter((c) => offlineBlockedIds.has(c.id)),
    } as T;
  }
  const threadMatch = clean.match(/^\/dm\/thread\/([^/]+)$/);
  if (method === 'GET' && threadMatch) {
    const userId = threadMatch[1];
    const contact = offlineContacts.find((c) => c.id === userId) || {
      id: userId,
      username: offlineUsers[userId]?.username || 'Utilisateur',
      avatarUrl: offlineUsers[userId]?.avatarUrl,
    };
    const messages = offlineDirectMessages.filter(
      (m) =>
        (m.senderId === OFFLINE_DEMO_USER.id && m.receiverId === userId) ||
        (m.senderId === userId && m.receiverId === OFFLINE_DEMO_USER.id)
    );
    return { messages, otherUser: contact } as T;
  }
  if (method === 'POST' && threadMatch) {
    const userId = threadMatch[1];
    const body = parseBody<{ content: string }>(opts);
    const message = {
      id: `dm_${Date.now()}`,
      senderId: OFFLINE_DEMO_USER.id,
      receiverId: userId,
      content: body.content,
      timestamp: Date.now(),
      accepted: true,
    };
    offlineDirectMessages.push(message);
    return { message } as T;
  }
  if (method === 'POST' && clean.startsWith('/dm/block/')) {
    offlineBlockedIds.add(clean.split('/').pop()!);
    return { ok: true } as T;
  }
  if (method === 'DELETE' && clean.startsWith('/dm/block/')) {
    offlineBlockedIds.delete(clean.split('/').pop()!);
    return { ok: true } as T;
  }
  if (method === 'DELETE' && clean.startsWith('/dm/messages/')) {
    return { ok: true, messageId: clean.split('/').pop()!, scope: 'hidden' } as T;
  }

  if (method === 'GET' && clean === '/gifts/catalog') {
    return { gifts: [{ type: 'heart', label: 'Cœur' }, { type: 'don', label: 'Don' }] } as T;
  }
  const liveGiftsMatch = clean.match(/^\/gifts\/live\/([^/]+)$/);
  if (method === 'GET' && liveGiftsMatch) {
    return { gifts: [] } as T;
  }
  if (method === 'POST' && clean === '/gifts/send') {
    return { gift: { id: `gift_${Date.now()}` } } as T;
  }

  if (method === 'POST' && clean.startsWith('/platforms/')) {
    return { ok: true, user: currentUser() } as T;
  }
  if (method === 'DELETE' && clean.startsWith('/platforms/')) {
    return { ok: true, user: currentUser() } as T;
  }
  if (method === 'PATCH' && clean === '/users/me/settings') {
    const body = parseBody<{ shareDistance?: boolean; locationPrecision?: 'precise' | 'city' }>(opts);
    offlineUsers[OFFLINE_DEMO_USER.id] = { ...currentUser(), ...body };
    return { user: currentUser() } as T;
  }

  const hostRatingMatch = clean.match(/^\/ratings\/host\/([^/]+)$/);
  if (method === 'GET' && hostRatingMatch) {
    return {
      rating: offlineHostRatings[hostRatingMatch[1]] || { average: 0, count: 0 },
    } as T;
  }
  if (method === 'POST' && clean === '/ratings') {
    const body = parseBody<{ hostId: string; stars: number }>(opts);
    const prev = offlineHostRatings[body.hostId] || { average: 0, count: 0 };
    const rating = { average: body.stars, count: prev.count + 1, userRating: body.stars };
    offlineHostRatings[body.hostId] = rating;
    return { rating } as T;
  }

  if (method === 'POST' && clean.startsWith('/notifications/heart/')) {
    return { ok: true, matched: true, match: offlineMatches[0] || null, waitingForReply: false } as T;
  }
  const matchStatusMatch = clean.match(/^\/notifications\/matches\/with\/([^/]+)$/);
  if (method === 'GET' && matchStatusMatch) {
    const match = offlineMatches.find((m) => m.otherUser.id === matchStatusMatch[1]);
    return { matched: !!match, match: match || null, theySentHeart: false, iSentHeart: !!match } as T;
  }
  if (method === 'GET' && clean === '/notifications/matches/list') {
    return { matches: [...offlineMatches] } as T;
  }
  if (method === 'GET' && clean === '/notifications/list') {
    const unread = offlineNotifications.filter((n) => !n.read).length;
    return { notifications: [...offlineNotifications], unreadCount: unread } as T;
  }
  if (method === 'PATCH' && clean === '/notifications/read-all') {
    offlineNotifications.forEach((n) => {
      n.read = true;
    });
    return { ok: true } as T;
  }

  const followMatch = clean.match(/^\/users\/([^/]+)\/follow$/);
  if (method === 'POST' && followMatch) {
    offlineFollowingIds.add(followMatch[1]);
    return { ok: true, followingId: followMatch[1], isFollowing: true } as T;
  }
  if (method === 'DELETE' && followMatch) {
    offlineFollowingIds.delete(followMatch[1]);
    return { ok: true, followingId: followMatch[1], isFollowing: false } as T;
  }
  if (method === 'GET' && clean === '/users/me/following') {
    const following = [...offlineFollowingIds]
      .map((id) => offlineUsers[id])
      .filter(Boolean) as User[];
    return { following, followingIds: [...offlineFollowingIds] } as T;
  }

  if (method === 'GET' && (clean === '/reels' || clean.startsWith('/reels?'))) {
    return { reels: MUSIC_REELS.slice(0, 20) as MusicReel[] } as T;
  }
  if (method === 'GET' && clean === '/reels/private/me') {
    return { reels: [] } as T;
  }
  if (method === 'GET' && clean === '/reels/user-created') {
    return { reels: [] } as T;
  }
  const reelUserMatch = clean.match(/^\/reels\/user\/([^/]+)$/);
  if (method === 'GET' && reelUserMatch) {
    return { reels: [] } as T;
  }
  const reelViewMatch = clean.match(/^\/reels\/([^/]+)\/view$/);
  if (method === 'POST' && reelViewMatch) {
    const count = (offlineReelViews.get(reelViewMatch[1]) || 0) + 1;
    offlineReelViews.set(reelViewMatch[1], count);
    return { ok: true, viewCount: count, alreadyViewed: false } as T;
  }
  const reelStatsMatch = clean.match(/^\/reels\/([^/]+)\/stats$/);
  if (method === 'GET' && reelStatsMatch) {
    const reelId = reelStatsMatch[1];
    return {
      stats: {
        heartCount: 12,
        commentCount: (offlineReelComments[reelId] || []).length,
        shareCount: 3,
        viewCount: offlineReelViews.get(reelId) || 42,
        likedByMe: offlineReelHearts.has(reelId),
        sharedByMe: offlineReelShares.has(reelId),
        commentedByMe: false,
      },
    } as T;
  }
  const reelDetailMatch = clean.match(/^\/reels\/([^/]+)$/);
  if (method === 'GET' && reelDetailMatch) {
    const reel = MUSIC_REELS.find((r) => r.id === reelDetailMatch[1]);
    if (!reel) throw new Error('Reel introuvable');
    return { reel } as T;
  }
  const reelHeartMatch = clean.match(/^\/reels\/([^/]+)\/heart$/);
  if (method === 'POST' && reelHeartMatch) {
    const reelId = reelHeartMatch[1];
    const liked = !offlineReelHearts.has(reelId);
    if (liked) offlineReelHearts.add(reelId);
    else offlineReelHearts.delete(reelId);
    return { liked, heartCount: liked ? 13 : 12 } as T;
  }
  const reelShareMatch = clean.match(/^\/reels\/([^/]+)\/share$/);
  if (method === 'POST' && reelShareMatch) {
    offlineReelShares.add(reelShareMatch[1]);
    return { ok: true, shareCount: 4, alreadyShared: false } as T;
  }
  const reelCommentsMatch = clean.match(/^\/reels\/([^/]+)\/comments$/);
  if (method === 'GET' && reelCommentsMatch) {
    return { comments: offlineReelComments[reelCommentsMatch[1]] || [] } as T;
  }
  if (method === 'POST' && reelCommentsMatch) {
    const body = parseBody<{ content: string }>(opts);
    const comment = {
      id: `rc_${Date.now()}`,
      reelId: reelCommentsMatch[1],
      userId: OFFLINE_DEMO_USER.id,
      username: currentUser().username,
      avatarUrl: currentUser().avatarUrl,
      content: body.content,
      createdAt: Date.now(),
    };
    offlineReelComments[reelCommentsMatch[1]] = [
      ...(offlineReelComments[reelCommentsMatch[1]] || []),
      comment,
    ];
    return { comment, commentCount: offlineReelComments[reelCommentsMatch[1]].length } as T;
  }
  if (method === 'POST' && clean === '/reels') {
    const body = parseBody<{
      title: string;
      artist: string;
      genre: string;
      mediaType?: 'video' | 'image';
      mediaUrl?: string;
      posterUrl?: string;
      visibility?: 'public' | 'private';
      isPrivate?: boolean;
    }>(opts);
    const reel: MusicReel = {
      id: `reel_${Date.now()}`,
      title: body.title || 'Mon reel',
      artist: body.artist || 'Moi',
      genre: body.genre || 'Démo',
      mediaType: body.mediaType || 'video',
      videoUrl: body.mediaUrl,
      posterUrl: body.posterUrl || body.mediaUrl || '',
      authorId: OFFLINE_DEMO_USER.id,
      visibility: body.visibility || 'private',
      isPrivate: body.isPrivate ?? true,
    };
    return { reel } as T;
  }
  const reelDeleteMatch = clean.match(/^\/reels\/([^/]+)$/);
  if (method === 'DELETE' && reelDeleteMatch) {
    return { ok: true } as T;
  }
  if (method === 'POST' && clean.includes('/publish')) {
    return { reel: MUSIC_REELS[0] } as T;
  }

  if (method === 'DELETE' && clean.includes('/chat/')) {
    return { ok: true, messageId: 'demo' } as T;
  }
  if (method === 'POST' && clean.includes('/playback/')) {
    const salon = offlineSalons[0];
    return {
      playbackState: salon.playbackState,
      queue: offlineQueues[salon.id] || [],
    } as T;
  }
  if (method === 'POST' && clean.includes('/proposals/') && clean.includes('/accept')) {
    return { proposal: {}, queueItem: {}, queue: [], playbackState: offlineSalons[0].playbackState } as T;
  }
  if (method === 'POST' && clean.includes('/proposals/') && clean.includes('/reject')) {
    return { proposal: {} } as T;
  }
  if (method === 'POST' && clean.includes('/allowed')) {
    return { salon: cloneSalon(offlineSalons[0]) } as T;
  }
  if (method === 'DELETE' && clean.includes('/allowed/')) {
    return { salon: cloneSalon(offlineSalons[0]) } as T;
  }

  console.warn('[offline-demo] route non mockée:', method, path);
  return {} as T;
}

export async function offlineGetLive(id: string): Promise<{ live: import('../types').Live }> {
  await delay();
  const live = offlineLives.find((l) => l.id === id);
  if (!live) throw new Error('Live introuvable');
  return { live: { ...live, playbackState: { ...live.playbackState } } };
}
