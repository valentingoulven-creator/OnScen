import type { RelationshipStatus, User } from '../models/schema';

export const VALID_RELATIONSHIP_STATUSES: RelationshipStatus[] = [
  'celibataire',
  'en_couple',
];

export const MAX_RELATIONSHIP_STATUS_CUSTOM_LENGTH = 80;

export function applyRelationshipSettings(
  user: User,
  input: { relationshipStatus?: unknown; relationshipStatusCustom?: unknown }
): { ok: true } | { ok: false; error: string } {
  const { relationshipStatus, relationshipStatusCustom } = input;
  if (relationshipStatus === undefined && relationshipStatusCustom === undefined) {
    return { ok: true };
  }

  if (relationshipStatus === null || relationshipStatus === '') {
    delete user.relationshipStatus;
    delete user.relationshipStatusCustom;
    return { ok: true };
  }

  if (relationshipStatus === undefined) {
    if (relationshipStatusCustom !== undefined) {
      delete user.relationshipStatusCustom;
    }
    return { ok: true };
  }

  if (typeof relationshipStatus !== 'string') return { ok: true };

  if (relationshipStatus === 'celibataire' || relationshipStatus === 'en_couple') {
    user.relationshipStatus = relationshipStatus;
    delete user.relationshipStatusCustom;
    return { ok: true };
  }

  delete user.relationshipStatus;
  delete user.relationshipStatusCustom;
  return { ok: true };
}
