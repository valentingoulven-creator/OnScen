import crypto from 'crypto';
import { db, type User } from '../models/schema';
import { schedulePersist } from './persist';
import { schedulePersistUserToPg } from './pgUsers';

/** Émet un token de vérification e-mail (24 h) et persiste le compte. */
export function issueVerificationToken(user: User): { token: string; url: string } {
  const token = crypto.randomBytes(32).toString('hex');
  user.verificationToken = token;
  user.verificationTokenExpiry = Date.now() + 24 * 60 * 60 * 1000;
  db.users.set(user.id, user);
  schedulePersistUserToPg(user);
  schedulePersist();
  const appUrl = process.env.WEB_APP_URL ?? 'https://onscen.com';
  return { token, url: `${appUrl}/verify-email?token=${token}` };
}
