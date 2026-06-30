/** Chat attachments must be HTTPS URLs (no javascript:, data:, or http:). */
export function isAllowedChatAttachmentUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
