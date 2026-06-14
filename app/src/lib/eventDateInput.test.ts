import { describe, expect, it } from 'vitest';
import { parseEventDateInputValue } from './eventDateInput';

describe('parseEventDateInputValue', () => {
  it('accepts ISO datetime-local value', () => {
    expect(parseEventDateInputValue('2026-12-25T19:30', 'fr')).toBe('2026-12-25T19:30');
  });

  it('accepts European display format', () => {
    expect(parseEventDateInputValue('25/12/2026 19:30', 'fr')).toBe('2026-12-25T19:30');
  });

  it('rejects invalid ISO datetime-local value', () => {
    expect(parseEventDateInputValue('2026-02-30T19:30', 'fr')).toBeNull();
  });
});
