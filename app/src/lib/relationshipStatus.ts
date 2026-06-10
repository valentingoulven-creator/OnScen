import type { RelationshipStatus } from '../types';

export function getRelationshipEmoji(status: RelationshipStatus): string {
  return status === 'en_couple' ? '💑' : '✨';
}

export function getRelationshipDisplayLabel(
  status: RelationshipStatus,
  custom: string | undefined | null,
  labels: Record<RelationshipStatus, string>
): string {
  if (status === 'autre') return custom?.trim() || labels.autre;
  return labels[status];
}
