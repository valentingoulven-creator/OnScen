import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  assertRegistrationAllowed,
  getPublicAccessConfig,
  isAccessAdmin,
  isAccessControlEnabled,
  loadAccessControlFromPersist,
  setAccessPolicy,
  validateInviteCode,
  createInviteCode,
  consumeInviteCode,
} from './accessControl';
import type { User } from '../models/schema';

describe('accessControl', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
    delete process.env.ACCESS_CONTROL_ENABLED;
    delete process.env.MSDEV_PUBLIC_TUNNEL;
    loadAccessControlFromPersist({ registrationMode: 'open', updatedAt: Date.now() }, []);
  });

  afterEach(() => {
    process.env = envBackup;
  });

  it('désactivé par défaut sans variables tunnel', () => {
    expect(isAccessControlEnabled()).toBe(false);
    expect(getPublicAccessConfig().registrationMode).toBe('open');
  });

  it('active le mode strict avec MSDEV_PUBLIC_TUNNEL', () => {
    process.env.MSDEV_PUBLIC_TUNNEL = '1';
    loadAccessControlFromPersist(undefined, []);
    expect(isAccessControlEnabled()).toBe(true);
    expect(getPublicAccessConfig().adminApprovalRequired).toBe(true);
  });

  it('refuse inscription sans code en invite_only', () => {
    process.env.ACCESS_CONTROL_ENABLED = '1';
    setAccessPolicy({ registrationMode: 'invite_only' });
    const denied = assertRegistrationAllowed({});
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.status).toBe(400);
  });

  it('valide et consomme un code invitation', () => {
    process.env.ACCESS_CONTROL_ENABLED = '1';
    setAccessPolicy({ registrationMode: 'invite_only' });
    createInviteCode({ code: 'TEST-INVITE', maxUses: 2 });
    const v = validateInviteCode('test-invite');
    expect(v.ok).toBe(true);
    expect(consumeInviteCode('TEST-INVITE')).toBe(true);
    const again = validateInviteCode('TEST-INVITE');
    expect(again.ok).toBe(true);
    consumeInviteCode('TEST-INVITE');
    const exhausted = validateInviteCode('TEST-INVITE');
    expect(exhausted.ok).toBe(false);
  });

  it('en production exige isAdmin sans élévation implicite par email', () => {
    process.env.APP_ENV = 'production';
    const msdevUser = {
      id: 'u1',
      email: 'listener@msdev.local',
      username: 'soundy_dev',
      isAdmin: false,
    } as User;
    expect(isAccessAdmin(msdevUser)).toBe(false);
    expect(isAccessAdmin({ ...msdevUser, isAdmin: true })).toBe(true);
  });

  it('conserve les comptes msdev par défaut hors production', () => {
    process.env.APP_ENV = 'msdev';
    const msdevUser = {
      id: 'u1',
      email: 'listener@msdev.local',
      username: 'listener',
      isAdmin: false,
    } as User;
    expect(isAccessAdmin(msdevUser)).toBe(true);
  });
});
