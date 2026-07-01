import { isUploadedChatAttachmentUrl } from './chatAttachmentAssets';

/**
 * Pièce jointe chat autorisée : soit une URL https absolue, soit un fichier local
 * déjà validé/enregistré via POST /api/chat/attachment (jamais une data: URL brute —
 * elle doit être uploadée au préalable).
 */
export function isAllowedChatAttachmentUrl(url: string): boolean {
  const trimmed = url.trim();
  if (isUploadedChatAttachmentUrl(trimmed)) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
