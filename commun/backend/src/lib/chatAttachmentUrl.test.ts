import { describe, expect, it } from 'vitest';
import { isAllowedChatAttachmentUrl } from './chatAttachmentUrl';

describe('isAllowedChatAttachmentUrl', () => {
  it('accepts https URLs', () => {
    expect(isAllowedChatAttachmentUrl('https://cdn.example.com/file.png')).toBe(true);
  });

  it('rejects http URLs', () => {
    expect(isAllowedChatAttachmentUrl('http://cdn.example.com/file.png')).toBe(false);
  });

  it('rejects javascript URLs', () => {
    expect(isAllowedChatAttachmentUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects invalid URLs', () => {
    expect(isAllowedChatAttachmentUrl('not-a-url')).toBe(false);
  });

  it('accepts a local uploaded chat attachment path', () => {
    expect(
      isAllowedChatAttachmentUrl('/uploads/chat-attachments/abcdef0123456789abcdef01.jpg')
    ).toBe(true);
  });

  it('rejects a raw data: URL (must be uploaded first)', () => {
    expect(isAllowedChatAttachmentUrl('data:image/jpeg;base64,/9j/4AAQSkZJRg==')).toBe(false);
  });
});
