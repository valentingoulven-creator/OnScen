import { describe, expect, it } from 'vitest';
import { applyFollowingChanged } from './followingSync';

describe('applyFollowingChanged', () => {
  it('adds userId when following', () => {
    expect(applyFollowingChanged(new Set(['a']), 'b', true)).toEqual(new Set(['a', 'b']));
  });

  it('removes userId when unfollowing', () => {
    expect(applyFollowingChanged(new Set(['a', 'b']), 'b', false)).toEqual(new Set(['a']));
  });
});
