import { db } from '../models/schema';
import { invalidateProfileCache } from '../routes/auth';
import { purgeReportsForUser } from './contentReports';
import { getIo } from './ioInstance';
import { scheduleRemoveUserFromPg } from './pgUsers';
import {
  scheduleDeleteReelEngagementByUserFromPg,
  scheduleDeleteReelsByAuthorFromPg,
} from './pgReels';
import { deleteCompositionsByUser } from './compositions';
import { deleteAlbumsByUser } from './albums';
import { deleteObjectsByUrls } from './objectStorage';

const DELETED_LABEL = '[Compte supprimé]';

function anonymizeChatMessage(msg: { senderId: string; senderName: string; content: string }) {
  msg.senderId = 'deleted_user';
  msg.senderName = DELETED_LABEL;
  msg.content = '';
}

/**
 * Recense les URLs de médias possédés par l'utilisateur (photos de profil,
 * reels, stories, discographie, albums, pièces jointes DM/groupe envoyées)
 * avant la cascade RAM, pour purge effective du stockage (local + S3) — droit
 * à l'effacement RGPD art. 17. Les URLs externes (CDN tiers) sont ignorées
 * silencieusement par `deleteObjectsByUrls`.
 */
function collectUserOwnedMediaUrls(userId: string): Array<string | undefined> {
  const user = db.users.get(userId);
  const urls: Array<string | undefined> = [];

  if (user) {
    urls.push(user.avatarUrl);
    if (Array.isArray(user.profilePhotos)) urls.push(...user.profilePhotos);
  }

  for (const reel of db.userReels) {
    if (reel.authorId !== userId) continue;
    urls.push(reel.videoUrl, reel.posterUrl, reel.audioUrl);
  }

  for (const story of db.stories) {
    if (story.userId !== userId) continue;
    urls.push(story.imageUrl, story.videoUrl);
  }

  for (const album of db.albums) {
    if (album.userId !== userId) continue;
    urls.push(album.coverUrl);
  }

  for (const composition of db.compositions) {
    if (composition.userId !== userId) continue;
    urls.push(composition.fileUrl);
  }

  for (const post of db.feedPosts) {
    if (post.userId !== userId) continue;
    urls.push(post.imageUrl, post.videoUrl);
  }

  for (const dm of db.directMessages) {
    if (dm.senderId !== userId) continue;
    urls.push(dm.attachmentUrl);
  }

  return urls;
}

/** Suppression en cascade des données liées à un compte utilisateur. */
export function deleteUserAccountCascade(userId: string): void {
  // Capturé avant la cascade RAM (qui vide ces structures) pour purger
  // ensuite le stockage réel (local + S3) — droit à l'effacement RGPD.
  const ownedMediaUrls = collectUserOwnedMediaUrls(userId);

  for (const [salonId, salon] of db.salons) {
    if (salon.hostId === userId) {
      getIo()?.to(`salon_${salonId}`).emit('salon_ended', {
        salonId,
        reason: 'host_account_deleted',
      });
      db.salons.delete(salonId);
      db.salonChats.delete(salonId);
      db.salonQueues.delete(salonId);
      db.salonProposals.delete(salonId);
      db.salonBans.delete(salonId);
      continue;
    }
    if (salon.allowedUserIds?.includes(userId)) {
      salon.allowedUserIds = salon.allowedUserIds.filter((id) => id !== userId);
      db.salons.set(salonId, salon);
    }
    if (salon.vipModeratorIds?.includes(userId)) {
      salon.vipModeratorIds = salon.vipModeratorIds.filter((id) => id !== userId);
      db.salons.set(salonId, salon);
    }
  }

  for (const [liveId, live] of db.lives) {
    if (live.hostId === userId) {
      db.lives.delete(liveId);
      db.liveChats.delete(liveId);
      db.liveBans.delete(liveId);
      continue;
    }
    if (live.vipModeratorIds?.includes(userId)) {
      live.vipModeratorIds = live.vipModeratorIds.filter((id) => id !== userId);
      db.lives.set(liveId, live);
    }
  }

  for (const [, messages] of db.salonChats) {
    for (const msg of messages) {
      if (msg.senderId === userId) anonymizeChatMessage(msg);
    }
  }
  for (const [, messages] of db.liveChats) {
    for (const msg of messages) {
      if (msg.senderId === userId) anonymizeChatMessage(msg);
    }
  }

  db.directMessages = db.directMessages.filter(
    (m) => m.senderId !== userId && m.receiverId !== userId
  );

  db.groupMessages = db.groupMessages.filter((m) => m.senderId !== userId);

  db.messageGroups = db.messageGroups
    .map((g) => ({
      ...g,
      memberIds: g.memberIds.filter((id) => id !== userId),
    }))
    .filter((g) => g.memberIds.length > 0);

  db.userReels = db.userReels.filter((r) => r.authorId !== userId);
  scheduleDeleteReelsByAuthorFromPg(userId);
  scheduleDeleteReelEngagementByUserFromPg(userId);

  deleteAlbumsByUser(userId);
  deleteCompositionsByUser(userId);

  for (const [reelId, comments] of db.reelComments) {
    const filtered = comments.filter((c) => c.userId !== userId);
    if (filtered.length) db.reelComments.set(reelId, filtered);
    else db.reelComments.delete(reelId);
  }

  for (const [reelId, likers] of db.reelLikes) {
    if (likers.delete(userId)) {
      if (likers.size) db.reelLikes.set(reelId, likers);
      else db.reelLikes.delete(reelId);
    }
  }

  for (const [reelId, sharers] of db.reelShares) {
    if (sharers.delete(userId)) {
      if (sharers.size) db.reelShares.set(reelId, sharers);
      else db.reelShares.delete(reelId);
    }
  }

  for (const [reelId, viewers] of db.reelViews) {
    if (viewers.delete(userId)) {
      if (viewers.size) db.reelViews.set(reelId, viewers);
      else db.reelViews.delete(reelId);
    }
  }

  db.feedPosts = db.feedPosts.filter((p) => p.userId !== userId);

  for (const [postId, comments] of db.feedPostComments) {
    const filtered = comments.filter((c) => c.userId !== userId);
    if (filtered.length) db.feedPostComments.set(postId, filtered);
    else db.feedPostComments.delete(postId);
  }

  for (const [postId, likers] of db.feedPostLikes) {
    if (likers.delete(userId)) {
      if (likers.size) db.feedPostLikes.set(postId, likers);
      else db.feedPostLikes.delete(postId);
    }
  }

  db.feedPostFavorites.delete(userId);

  db.stories = db.stories.filter((s) => s.userId !== userId);

  db.notifications = db.notifications.filter(
    (n) => n.recipientId !== userId && n.senderId !== userId
  );

  db.heartEvents = db.heartEvents.filter((h) => h.fromId !== userId && h.toId !== userId);
  db.matches = db.matches.filter((m) => m.userIdA !== userId && m.userIdB !== userId);

  db.userBlocks = db.userBlocks.filter((b) => b.blockerId !== userId && b.blockedId !== userId);
  db.userMutes = db.userMutes.filter((m) => m.muterId !== userId && m.mutedId !== userId);
  db.hostRatings = db.hostRatings.filter((r) => r.hostId !== userId && r.raterId !== userId);
  db.gifts = db.gifts.filter((g) => g.senderId !== userId);

  for (const [followerId, following] of db.userFollows) {
    if (followerId === userId) {
      db.userFollows.delete(followerId);
      continue;
    }
    if (following.delete(userId)) {
      if (following.size) db.userFollows.set(followerId, following);
      else db.userFollows.delete(followerId);
    }
  }

  db.userFavorites.delete(userId);
  for (const [, favMap] of db.userFavorites) {
    favMap.delete(userId);
  }

  for (const key of [...db.dmPendingPairs.keys()]) {
    if (key.includes(userId)) db.dmPendingPairs.delete(key);
  }

  db.dmReadCursors.delete(userId);
  db.groupReadCursors.delete(userId);

  for (const [, banMap] of db.salonBans) {
    banMap.delete(userId);
  }
  for (const [, banMap] of db.liveBans) {
    banMap.delete(userId);
  }

  purgeReportsForUser(userId);
  invalidateProfileCache(userId);
  db.users.delete(userId);
  scheduleRemoveUserFromPg(userId);

  void deleteObjectsByUrls(ownedMediaUrls).catch((err) => {
    console.error('[accountDeletion] Échec purge stockage (RGPD):', userId, err);
  });
}
