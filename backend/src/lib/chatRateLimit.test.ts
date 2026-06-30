import { describe, expect, it } from 'vitest';
import { checkChatRateLimit } from './chatRateLimit';

describe('checkChatRateLimit', () => {
  it('allows messages under the limit', async () => {
    const userId = `user_${Date.now()}`;
    for (let i = 0; i < 12; i++) {
      expect(await checkChatRateLimit(userId)).toBe(true);
    }
  });

  it('blocks when limit exceeded in window', async () => {
    const userId = `user_flood_${Date.now()}`;
    for (let i = 0; i < 12; i++) await checkChatRateLimit(userId);
    expect(await checkChatRateLimit(userId)).toBe(false);
  });
});
