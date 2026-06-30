import { describe, expect, it, vi, afterEach } from 'vitest';
import { isStoreDirty, schedulePersist, startPersistLoop, stopPersistLoop } from './persist';

describe('persist dirty flag', () => {
  afterEach(async () => {
    await stopPersistLoop();
  });

  it('marks store dirty on schedulePersist', () => {
    expect(isStoreDirty()).toBe(false);
    schedulePersist();
    expect(isStoreDirty()).toBe(true);
  });

  it('skips interval flush when store is clean', async () => {
    vi.useFakeTimers();
    const saveSpy = vi.spyOn(await import('./pgStore'), 'savePersistedStoreToPostgres').mockResolvedValue();
    startPersistLoop();
    vi.advanceTimersByTime(10_500);
    expect(saveSpy).not.toHaveBeenCalled();
    vi.useRealTimers();
    saveSpy.mockRestore();
  });
});
