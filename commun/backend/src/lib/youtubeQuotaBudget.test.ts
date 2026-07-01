import { beforeEach, describe, expect, it } from 'vitest';
import {
  __resetYoutubeSearchQuotaForTests,
  canAttemptYoutubeSearchListCall,
  getYoutubeSearchQuotaStatus,
  recordYoutubeSearchListCall,
  SEARCH_LIST_DAILY_LIMIT,
  SEARCH_LIST_RESERVE,
} from './youtubeQuotaBudget';

describe('youtubeQuotaBudget', () => {
  beforeEach(() => {
    __resetYoutubeSearchQuotaForTests(0);
  });

  it('starts at zero usage with the full budget available', () => {
    const status = getYoutubeSearchQuotaStatus();
    expect(status.used).toBe(0);
    expect(status.limit).toBe(SEARCH_LIST_DAILY_LIMIT);
    expect(status.exhausted).toBe(false);
    expect(canAttemptYoutubeSearchListCall()).toBe(true);
  });

  it('increments usage on each recorded call', () => {
    recordYoutubeSearchListCall();
    recordYoutubeSearchListCall();
    expect(getYoutubeSearchQuotaStatus().used).toBe(2);
  });

  it('proactively blocks new attempts once within the reserve margin of the daily limit', () => {
    __resetYoutubeSearchQuotaForTests(SEARCH_LIST_DAILY_LIMIT - SEARCH_LIST_RESERVE);
    expect(canAttemptYoutubeSearchListCall()).toBe(false);
    expect(getYoutubeSearchQuotaStatus().exhausted).toBe(true);
  });

  it('still allows calls comfortably below the reserve margin', () => {
    __resetYoutubeSearchQuotaForTests(SEARCH_LIST_DAILY_LIMIT - SEARCH_LIST_RESERVE - 1);
    expect(canAttemptYoutubeSearchListCall()).toBe(true);
  });
});
