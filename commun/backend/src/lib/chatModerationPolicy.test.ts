import { describe, expect, it } from 'vitest';

import { compactForChatModeration, normalizeForChatModeration } from './chatModerationNormalize';
import { applyChatModerationPolicy } from './chatModerationPolicy';
import { prepareChatText } from './sanitizeUserText';

describe('normalizeForChatModeration', () => {
  it('strips accents and leetspeak', () => {
    expect(normalizeForChatModeration('Pùt@1n')).toBe('putain');
  });

  it('compacts spaced letters', () => {
    const n = normalizeForChatModeration('p u t a i n');
    expect(compactForChatModeration(n)).toBe('putain');
  });
});

describe('applyChatModerationPolicy', () => {
  it('masks profanity but allows message', () => {
    const r = applyChatModerationPolicy('putain de merde');
    expect(r.blocked).toBe(false);
    expect(r.text).not.toContain('putain');
    expect(r.text).toMatch(/\*/);
  });

  it('blocks hate slurs', () => {
    const r = applyChatModerationPolicy('you are a n1gg3r');
    expect(r.blocked).toBe(true);
    expect(r.reason).toBe('hate_speech');
  });

  it('blocks spam phrases', () => {
    const r = applyChatModerationPolicy('DM me for free crypto giveaway');
    expect(r.blocked).toBe(true);
    expect(r.reason).toBe('spam');
  });

  it('respects host extra blocked terms', () => {
    const r = applyChatModerationPolicy('hello rivalband', {
      extraBlockedTerms: ['rivalband'],
    });
    expect(r.blocked).toBe(true);
    expect(r.reason).toBe('blocked_term');
  });
});

describe('prepareChatText', () => {
  it('returns ok false with user message when blocked', () => {
    const r = prepareChatText('crypto giveaway today');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain('communauté');
  });
});
