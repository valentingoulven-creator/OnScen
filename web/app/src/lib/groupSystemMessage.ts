import type { TFunction } from 'i18next';
import type { GroupMessage, GroupSystemEvent } from '../types';

type SystemMeta = NonNullable<GroupMessage['systemMeta']>;

function formatGroupSystemEvent(
  systemEvent: GroupSystemEvent,
  meta: SystemMeta,
  t: TFunction
): string {
  const { actorName, targetName, newName } = meta;
  switch (systemEvent) {
    case 'group_created':
      return t('dm.groupSystem.created', { actor: actorName, name: newName ?? '' });
    case 'group_renamed':
      return t('dm.groupSystem.renamed', { actor: actorName, name: newName ?? '' });
    case 'member_added':
      return t('dm.groupSystem.memberAdded', { actor: actorName, target: targetName ?? '' });
    case 'member_removed':
      return t('dm.groupSystem.memberRemoved', { actor: actorName, target: targetName ?? '' });
    case 'member_left':
      return t('dm.groupSystem.memberLeft', { target: targetName ?? '' });
    case 'admin_transferred':
      return t('dm.groupSystem.adminTransferred', { actor: actorName, target: targetName ?? '' });
    default:
      return '';
  }
}

export function formatGroupSystemMessage(
  m: Pick<GroupMessage, 'kind' | 'content' | 'systemEvent' | 'systemMeta'>,
  t: TFunction
): string {
  if (m.kind !== 'system') return m.content;
  if (m.systemEvent && m.systemMeta) {
    const formatted = formatGroupSystemEvent(m.systemEvent, m.systemMeta, t);
    if (formatted) return formatted;
  }
  return m.content;
}

export function formatGroupConversationPreview(
  c: {
    lastMessage: string;
    lastMessageKind?: GroupMessage['kind'];
    lastSystemEvent?: GroupSystemEvent;
    lastSystemMeta?: SystemMeta;
  },
  t: TFunction
): string {
  if (c.lastMessageKind === 'system' && c.lastSystemEvent && c.lastSystemMeta) {
    return formatGroupSystemEvent(c.lastSystemEvent, c.lastSystemMeta, t);
  }
  return c.lastMessage;
}
