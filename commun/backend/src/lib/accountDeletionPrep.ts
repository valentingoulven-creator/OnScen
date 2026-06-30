import { cancelStripeSubscriptionsForUser } from './accountDeletionStripe';
import { purgeUserAccountFromPg } from './accountDeletionPg';
import { persistCreatorSubscriptionToPgAsync } from './pgSubscriptions';
import { isPostgresEnabled } from '../db/pool';
import { db } from '../models/schema';

/**
 * Async cleanup before/around account deletion: Stripe cancel + PG purge.
 * Call while user row still exists in RAM for subscription lookup.
 */
export async function prepareUserAccountDeletion(userId: string): Promise<void> {
  await cancelStripeSubscriptionsForUser(userId);

  for (const sub of db.creatorSubscriptions) {
    if (sub.subscriberId === userId || sub.creatorId === userId) {
      if (sub.status === 'active') {
        sub.status = 'canceled';
        sub.updatedAt = Date.now();
      }
      if (isPostgresEnabled()) persistCreatorSubscriptionToPgAsync(sub);
    }
  }

  db.creatorSubscriptions = db.creatorSubscriptions.filter(
    (s) => s.subscriberId !== userId && s.creatorId !== userId
  );

  await purgeUserAccountFromPg(userId);
}
