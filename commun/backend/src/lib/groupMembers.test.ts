import { describe, it, expect } from 'vitest';
import { canAddGroupMember, canRemoveGroupMember, canDeleteGroup, canTransferGroupCreator } from './groupMembers';
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

  it('autorise tout membre non-admin à quitter le groupe', () => {
    expect(canRemoveGroupMember(group, 'alice', 'alice')).toEqual({ ok: true });
  });

  it('refuse à l\'administrateur de quitter s\'il reste d\'autres membres', () => {
    const r = canRemoveGroupMember(group, 'creator', 'creator');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('administrateur');
  });

  it('autorise l\'administrateur seul à quitter le groupe', () => {
    const solo = { ...group, memberIds: ['creator'] };
    expect(canRemoveGroupMember(solo, 'creator', 'creator')).toEqual({ ok: true });
  });

  it('autorise le créateur à supprimer le groupe', () => {
    expect(canDeleteGroup(group, 'creator')).toEqual({ ok: true });
  });

  it('refuse à un non-créateur de supprimer le groupe', () => {
    const r = canDeleteGroup(group, 'alice');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('créateur');
  });

  it('autorise l\'administrateur à transférer le rôle', () => {
    expect(canTransferGroupCreator(group, 'creator', 'alice')).toEqual({ ok: true });
  });

  it('refuse le transfert à soi-même', () => {
    const r = canTransferGroupCreator(group, 'creator', 'creator');
    expect(r.ok).toBe(false);
  });

  it('refuse à un non-administrateur de transférer le rôle', () => {
    const r = canTransferGroupCreator(group, 'alice', 'bob');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('administrateur');
  });
});
