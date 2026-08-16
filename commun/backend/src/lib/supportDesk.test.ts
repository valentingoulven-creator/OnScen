import { describe, expect, it } from 'vitest';
import { canAdminReplyToTicket, canReopenTicket, canResolveTicket } from './supportDesk';

describe('supportDesk', () => {
  it('allows follow-up replies until the ticket is resolved', () => {
    expect(canAdminReplyToTicket('open')).toBe(true);
    expect(canAdminReplyToTicket('replied')).toBe(true);
    expect(canAdminReplyToTicket('resolved')).toBe(false);
  });

  it('allows resolve from open or replied, and reopen only when resolved', () => {
    expect(canResolveTicket('open')).toBe(true);
    expect(canResolveTicket('replied')).toBe(true);
    expect(canResolveTicket('resolved')).toBe(false);
    expect(canReopenTicket('resolved')).toBe(true);
    expect(canReopenTicket('open')).toBe(false);
  });
});
