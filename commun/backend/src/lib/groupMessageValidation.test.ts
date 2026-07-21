import { describe, it, expect } from 'vitest';
import { clientTriedForgedSystemMessage } from './groupMessageValidation';

describe('groupMessageValidation', () => {
  it('accepte un body avec content seul', () => {
    expect(clientTriedForgedSystemMessage({ content: 'hello' })).toBe(false);
  });

  it('refuse kind system', () => {
    expect(clientTriedForgedSystemMessage({ content: 'x', kind: 'system' })).toBe(true);
  });

  it('refuse systemEvent', () => {
    expect(clientTriedForgedSystemMessage({ content: 'x', systemEvent: 'group_renamed' })).toBe(true);
  });

  it('refuse systemMeta', () => {
    expect(
      clientTriedForgedSystemMessage({
        content: 'x',
        systemMeta: { actorName: 'Alice' },
      })
    ).toBe(true);
  });
});
