import { describe, it, expect } from 'vitest';
import { canAddGroupMember, canRemoveGroupMember } from './groupMembers';
import type { MessageGroup } from '../models/schema';

const group: MessageGroup = {
  id: 'grp_test',
  name: 'Test',
  creatorId: 'creator',
  memberIds: ['creator', 'alice', 'bob'],
  createdAt: 0,
};

describe('groupMembers', () => {
  it('autorise un membre à ajouter un nouvel utilisateur', () => {
    expect(canAddGroupMember(group, 'alice', 'carol')).toEqual({ ok: true });
  });

  it('refuse d\'ajouter un membre déjà présent', () => {
    const r = canAddGroupMember(group, 'alice', 'bob');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('déjà membre');
  });

  it('autorise le créateur à retirer un autre membre', () => {
    expect(canRemoveGroupMember(group, 'creator', 'bob')).toEqual({ ok: true });
  });

  it('refuse à un non-créateur de retirer un autre membre', () => {
    const r = canRemoveGroupMember(group, 'alice', 'bob');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('créateur');
  });

  it('autorise tout membre à quitter le groupe', () => {
    expect(canRemoveGroupMember(group, 'alice', 'alice')).toEqual({ ok: true });
  });
});
