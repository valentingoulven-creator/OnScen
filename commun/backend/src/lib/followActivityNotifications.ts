import { db, type User } from '../models/schema';
import { pushNotification } from './notifications';
import { runInBatchesAsync } from './asyncFanOut';

export type FollowActivityNotificationType =
  | 'salon_created'
  | 'live_started'
  | 'event_created'
  | 'album_published'
  | 'track_published'
  | 'reel_published';

function getFollowActivityRecipientIds(creatorId: string): string[] {
  const ids: string[] = [];
  for (const [followerId, set] of db.userFollows) {
    if (!set.has(creatorId) || followerId === creatorId) continue;
    const enabled = db.userFollowNotificationPrefs.get(followerId)?.get(creatorId);
    if (enabled === false) continue;
    ids.push(followerId);
  }
  return ids;
}

export function notifyFollowersCreatorActivity(params: {
  creator: Pick<User, 'id' | 'username' | 'avatarUrl'>;
  type: FollowActivityNotificationType;
  message: string;
  salonId?: string;
  liveId?: string;
  postId?: string;
  reelId?: string;
  albumId?: string;
  compositionId?: string;
}): void {
  const recipientIds = getFollowActivityRecipientIds(params.creator.id);
  if (recipientIds.length === 0) return;

  runInBatchesAsync(recipientIds, (recipientId) => {
    pushNotification({
      recipientId,
      senderId: params.creator.id,
      senderName: params.creator.username,
      senderAvatarUrl: params.creator.avatarUrl,
      type: params.type,
      message: params.message,
      peerUserId: params.creator.id,
      salonId: params.salonId,
      liveId: params.liveId,
      postId: params.postId,
      reelId: params.reelId,
      albumId: params.albumId,
      compositionId: params.compositionId,
    });
  });
}
