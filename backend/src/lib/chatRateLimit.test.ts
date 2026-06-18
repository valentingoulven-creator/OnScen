import { describe, expect, it } from 'vitest';
import { checkChatRateLimit } from './chatRateLimit';

describe('checkChatRateLimit', () => {
  it('allows messages under the limit', () => {
    const userId = `user_${Date.now()}`;
    for (let i = 0; i < 12; i++) {
      expect(checkChatRateLimit(userId)).toBe(true);
    }
  });

  it('blocks when limit exceeded in window', () => {
    const userId = `user_flood_${Date.now()}`;
    for (let i = 0; i < 12; i++) checkChatRateLimit(userId);
    expect(checkChatRateLimit(userId)).toBe(false);
  });
});
