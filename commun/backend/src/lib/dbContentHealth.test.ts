import { describe, expect, it } from 'vitest';

import { getDbContentHealthReport } from './dbContentHealth';

describe('dbContentHealth', () => {
  it('returns report when postgres disabled', async () => {
    const report = await getDbContentHealthReport();
    expect(report).toHaveProperty('ok');
    expect(report).toHaveProperty('memory');
    expect(report).toHaveProperty('tables');
  });
});
