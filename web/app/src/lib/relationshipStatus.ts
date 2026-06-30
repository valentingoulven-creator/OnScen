import type { RelationshipStatus } from '../types';

export function getRelationshipEmoji(status: RelationshipStatus): string {
  return status === 'en_couple' ? '💑' : '✨';
}

export function getRelationshipDisplayLabel(
  status: Exclude<RelationshipStatus, 'autre'>,
  _custom: string | undefined | null,
  labels: Record<Exclude<RelationshipStatus, 'autre'>, string>
): string {
  return labels[status];
}
