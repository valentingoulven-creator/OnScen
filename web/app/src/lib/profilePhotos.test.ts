import { describe, expect, it } from 'vitest';
import {
  countPersistableProfilePhotos,
  formHasProfilePhotoEdits,
  normalizeProfilePhotoSlots,
  profilePhotosChanged,
  shouldIncludeProfilePhotosInSave,
} from './profilePhotos';

const JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA//2Q==';

describe('profilePhotos save flow', () => {
  it('preserves gallery-only slot layout', () => {
    expect(normalizeProfilePhotoSlots(['', JPEG])).toEqual(['', JPEG]);
  });

  it('detects blob previews as edits even when normalize strips them', () => {
    const blob = 'blob:http://localhost:5173/preview-1';
    expect(profilePhotosChanged([], [blob])).toBe(true);
    expect(formHasProfilePhotoEdits([blob])).toBe(true);
    expect(shouldIncludeProfilePhotosInSave([], [blob])).toBe(true);
  });

  it('includes profilePhotos when form has gallery photo without avatar', () => {
    const next = ['', JPEG];
    expect(shouldIncludeProfilePhotosInSave([], next)).toBe(true);
    expect(countPersistableProfilePhotos(next)).toBe(1);
  });

  it('includes profilePhotos when clearing existing photos', () => {
    const current = ['', JPEG];
    expect(shouldIncludeProfilePhotosInSave(current, [])).toBe(true);
  });

  it('ignores dicebear placeholders in slots', () => {
    const dicebear = 'https://api.dicebear.com/7.x/adventurer/svg?seed=Val';
    expect(normalizeProfilePhotoSlots([dicebear])).toEqual([]);
    expect(countPersistableProfilePhotos([dicebear])).toBe(0);
  });
});
