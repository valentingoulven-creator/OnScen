import type { MessageGroup } from '../models/schema';

export function canAddGroupMember(
  group: MessageGroup,
  actorId: string,
  targetUserId: string
): { ok: true } | { ok: false; error: string } {
  if (!group.memberIds.includes(actorId)) {
    return { ok: false, error: 'Accès refusé' };
  }
  if (targetUserId === actorId) {
    return { ok: false, error: 'Vous êtes déjà dans le groupe' };
  }
  if (group.memberIds.includes(targetUserId)) {
    return { ok: false, error: 'Cet utilisateur est déjà membre' };
  }
  return { ok: true };
}

export function canRemoveGroupMember(
  group: MessageGroup,
  actorId: string,
  targetUserId: string
): { ok: true } | { ok: false; error: string } {
  if (!group.memberIds.includes(actorId)) {
    return { ok: false, error: 'Accès refusé' };
  }
  if (!group.memberIds.includes(targetUserId)) {
    return { ok: false, error: 'Membre introuvable' };
  }
  if (actorId === targetUserId) {
    return { ok: true };
  }
  if (group.creatorId !== actorId) {
    return { ok: false, error: 'Seul le créateur du groupe peut retirer un membre' };
  }
  return { ok: true };
}
