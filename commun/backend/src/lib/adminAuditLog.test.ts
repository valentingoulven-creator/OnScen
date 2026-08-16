import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.fn();
const pgEnabled = { value: true };

vi.mock('../db/pool', () => ({
  isPostgresEnabled: () => pgEnabled.value,
  getPool: () => ({ query }),
}));

import { listAdminAuditForTarget } from './adminAuditLog';

describe('listAdminAuditForTarget', () => {
  beforeEach(() => {
    query.mockReset();
    pgEnabled.value = true;
  });

  it('returns unavailable when Postgres is off', async () => {
    pgEnabled.value = false;
    const result = await listAdminAuditForTarget('user-1');
    expect(result).toEqual({ entries: [], available: false });
    expect(query).not.toHaveBeenCalled();
  });

  it('maps audit rows for a target user', async () => {
    query.mockResolvedValue({
      rows: [
        {
          id: 12,
          admin_id: 'admin-1',
          action: 'user_block',
          target_type: 'user',
          target_id: 'user-1',
          details: { days: 7 },
          ip: '127.0.0.1',
          created_at: new Date('2026-08-16T10:00:00.000Z'),
        },
      ],
    });
    const result = await listAdminAuditForTarget('user-1', 20);
    expect(result.available).toBe(true);
    expect(result.entries).toEqual([
      {
        id: '12',
        adminId: 'admin-1',
        action: 'user_block',
        targetType: 'user',
        targetId: 'user-1',
        details: { days: 7 },
        ip: '127.0.0.1',
        createdAt: '2026-08-16T10:00:00.000Z',
      },
    ]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('WHERE target_id = $1'), [
      'user-1',
      20,
    ]);
  });

  it('returns unavailable when the query fails', async () => {
    query.mockRejectedValue(new Error('relation missing'));
    const result = await listAdminAuditForTarget('user-1');
    expect(result).toEqual({ entries: [], available: false });
  });
});
