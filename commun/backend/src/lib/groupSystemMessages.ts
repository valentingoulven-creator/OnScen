import { db, type GroupMessage } from '../models/schema';
import { getIo } from './ioInstance';
import { schedulePersist } from './persist';

export type GroupSystemEvent =
  | 'group_created'
  | 'group_renamed'
  | 'member_added'
  | 'member_removed'
  | 'member_left'
  | 'admin_transferred';

export type GroupSystemMeta = {
  actorName: string;
  targetName?: string;
  oldName?: string;
  newName?: string;
};

export function usernameOf(userId: string): string {
  return db.users.get(userId)?.username ?? 'Membre';
}

function systemContentFr(event: GroupSystemEvent, meta: GroupSystemMeta): string {
  const { actorName, targetName, newName } = meta;
  switch (event) {
    case 'group_created':
      return `${actorName} a créé le groupe « ${newName ?? ''} »`;
    case 'group_renamed':
      return `${actorName} a renommé le groupe « ${newName ?? ''} »`;
    case 'member_added':
      return `${actorName} a ajouté ${targetName ?? 'un membre'} au groupe`;
    case 'member_removed':
      return `${actorName} a retiré ${targetName ?? 'un membre'} du groupe`;
    case 'member_left':
      return `${targetName ?? 'Un membre'} a quitté le groupe`;
    case 'admin_transferred':
      return `${actorName} a nommé ${targetName ?? 'un membre'} administrateur du groupe`;
    default:
      return '';
  }
}

/** Texte FR de fallback (preview API, logs). Préférer systemEvent + systemMeta côté client pour i18n. */
export function formatGroupSystemContentFr(event: GroupSystemEvent, meta: GroupSystemMeta): string {
  return systemContentFr(event, meta);
}

/** Insère un message système dans le fil et notifie tous les membres (y compris l'auteur). */
export function appendGroupSystemMessage(
  groupId: string,
  actorId: string,
  systemEvent: GroupSystemEvent,
  systemMeta: GroupSystemMeta
): GroupMessage | null {
  const group = db.messageGroups.find((g) => g.id === groupId);
  if (!group) return null;

  const content = systemContentFr(systemEvent, systemMeta);
  if (!content) return null;

  const msg: GroupMessage = {
    id: `gm_sys_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    groupId,
    senderId: actorId,
    content,
    timestamp: Date.now(),
    kind: 'system',
    systemEvent,
    systemMeta,
  };
  db.groupMessages.push(msg);

  const actor = db.users.get(actorId);
  const payload = {
    ...msg,
    senderName: actor?.username,
    senderAvatarUrl: actor?.avatarUrl,
    groupName: group.name,
  };

  for (const memberId of group.memberIds) {
    getIo()?.to(`user_${memberId}`).emit('group_message', payload);
  }

  schedulePersist();
  return msg;
}
