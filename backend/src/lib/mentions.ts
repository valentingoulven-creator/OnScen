import { db } from '../models/schema';
import { pushNotification } from './notifications';

/** Extrait les @usernames uniques depuis un texte libre. */
export function extractMentions(text: string): string[] {
  const matches = text.matchAll(/@([a-zA-Z0-9_.-]+)/g);
  return [...new Set([...matches].map((m) => m[1].toLowerCase()))];
}

/**
 * Résout les @usernames trouvés dans `text` en utilisateurs réels et envoie
 * une notification de type 'mention' à chacun.
 */
export function notifyMentions(
  text: string,
  authorId: string,
  authorName: string,
  context: 'post' | 'story' | 'event' | 'comment',
  contextId: string,
  avatarUrl?: string
): void {
  const usernames = extractMentions(text);
  if (usernames.length === 0) return;

  const contextLabel =
    context === 'post'
      ? 'une publication'
      : context === 'story'
        ? 'une story'
        : context === 'comment'
          ? 'un commentaire'
          : 'un événement';

  for (const username of usernames) {
    const user = [...db.users.values()].find(
      (u) => u.username.toLowerCase() === username && u.id !== authorId
    );
    if (!user) continue;
    pushNotification({
      recipientId: user.id,
      type: 'mention',
      senderId: authorId,
      senderName: authorName,
      senderAvatarUrl: avatarUrl,
      message: `${authorName} vous a mentionné dans ${contextLabel} 📣`,
      peerUserId: authorId,
    });
  }
}
