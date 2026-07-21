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

export function canDeleteGroup(
  group: MessageGroup,
  actorId: string
): { ok: true } | { ok: false; error: string } {
  if (!group.memberIds.includes(actorId)) {
    return { ok: false, error: 'Accès refusé' };
  }
  if (group.creatorId !== actorId) {
    return { ok: false, error: 'Seul le créateur peut supprimer le groupe' };
  }
  return { ok: true };
}

export function canRenameGroup(
  group: MessageGroup,
  actorId: string
): { ok: true } | { ok: false; error: string } {
  if (!group.memberIds.includes(actorId)) {
    return { ok: false, error: 'Accès refusé' };
  }
  return { ok: true };
}

export function canTransferGroupCreator(
  group: MessageGroup,
  actorId: string,
  newCreatorId: string
): { ok: true } | { ok: false; error: string } {
  if (!group.memberIds.includes(actorId)) {
    return { ok: false, error: 'Accès refusé' };
  }
  if (group.creatorId !== actorId) {
    return { ok: false, error: 'Seul l\'administrateur peut transférer ce rôle' };
  }
  if (newCreatorId === actorId) {
    return { ok: false, error: 'Vous êtes déjà administrateur' };
  }
  if (!group.memberIds.includes(newCreatorId)) {
    return { ok: false, error: 'Membre introuvable' };
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
    if (group.creatorId === actorId && group.memberIds.length > 1) {
      return {
        ok: false,
        error: 'Transférez le rôle d\'administrateur avant de quitter le groupe',
      };
    }
    return { ok: true };
  }
  if (group.creatorId !== actorId) {
    return { ok: false, error: 'Seul le créateur du groupe peut retirer un membre' };
  }
  return { ok: true };
}
