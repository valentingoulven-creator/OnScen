import crypto from 'crypto';

/** Collision-resistant user id — avoids Date.now() sequential guessing. */
export function generateUserId(): string {
  return `user_${crypto.randomBytes(12).toString('hex')}`;
}
