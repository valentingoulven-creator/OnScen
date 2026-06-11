import { db } from '../models/schema';
import { isDevUser } from './accessControl';

export function isDevUserId(userId: string | undefined): boolean {
  if (!userId) return false;
  return isDevUser(db.users.get(userId));
}
