import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { getPublicDir } from '../paths';
import { validateImageMagicBytes } from './imageValidation';

/** Pièce jointe chat (DM, salon, live) — image ou fichier générique, 10 Mo max décodé. */
export const CHAT_ATTACHMENT_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_CHAT_ATTACHMENT_DATA_CHARS =
  Math.ceil((CHAT_ATTACHMENT_MAX_FILE_BYTES * 4) / 3) + 64;

const IMAGE_MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/** Types non-image explicitement autorisés (alignés sur le picker DM côté client). */
const FILE_MIME_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'video/mp4': 'mp4',
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/plain': 'txt',
  'text/csv': 'csv',
};

const ALL_MIME_EXT: Record<string, string> = { ...IMAGE_MIME_EXT, ...FILE_MIME_EXT };

const DATA_URL_RE = /^data:([a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+)(?:;[^;,]+)*;base64,([A-Za-z0-9+/=]+)$/;

/**
 * Vérifie les magic bytes des pièces jointes non-image (PDF/ZIP/Office/MP3/MP4).
 * Sans ça, un client pouvait déclarer n'importe quel MIME autorisé sur un contenu
 * binaire arbitraire — le fichier était accepté sur la seule foi du header data:.
 * `text/plain`/`text/csv` n'ont pas de signature binaire fiable : on rejette au
 * minimum les payloads qui ressemblent à du HTML/script (défense en profondeur,
 * en plus du `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff`
 * déjà appliqués au service des uploads).
 */
function validateNonImageMagicBytes(buffer: Buffer, mime: string): boolean {
  if (buffer.length < 4) return false;
  switch (mime) {
    case 'application/pdf':
      return buffer.subarray(0, 4).toString('latin1') === '%PDF';
    case 'application/zip':
    case 'application/x-zip-compressed':
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      // docx/xlsx sont des conteneurs ZIP (OOXML).
      return buffer[0] === 0x50 && buffer[1] === 0x4b && (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07);
    case 'application/msword':
    case 'application/vnd.ms-excel':
      // Format OLE compound (legacy .doc/.xls).
      return buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0;
    case 'audio/mpeg':
    case 'audio/mp3':
      return (
        (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) || // ID3
        (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) // frame sync MPEG
      );
    case 'video/mp4':
      return buffer.length >= 12 && buffer.subarray(4, 8).toString('latin1') === 'ftyp';
    case 'text/plain':
    case 'text/csv': {
      const head = buffer.subarray(0, 512).toString('utf8').toLowerCase();
      return !/<\s*(script|html|iframe|object|embed)\b/.test(head);
    }
    default:
      return true;
  }
}

export const UPLOADS_CHAT_ATTACHMENT_RE =
  /^\/uploads\/chat-attachments\/[a-f0-9]{24}\.[a-z0-9]{2,5}$/i;

export function isUploadedChatAttachmentUrl(url: string): boolean {
  return UPLOADS_CHAT_ATTACHMENT_RE.test(url.trim());
}

function uploadsDir(): string {
  return path.join(getPublicDir(), 'uploads', 'chat-attachments');
}

export interface ChatAttachmentUploadResult {
  url: string;
  mimeType: string;
  size: number;
  isImage: boolean;
}

/**
 * Valide et enregistre une pièce jointe de chat encodée en data URL, puis renvoie
 * une URL locale servie en HTTPS par le backend (jamais la data: URL brute).
 */
export function saveChatAttachmentFromDataUrl(dataUrl: string): ChatAttachmentUploadResult {
  const trimmed = String(dataUrl).trim();
  const match = DATA_URL_RE.exec(trimmed);
  if (!match) {
    throw new Error('Pièce jointe invalide');
  }
  const mime = match[1].toLowerCase();
  const ext = ALL_MIME_EXT[mime];
  if (!ext) {
    throw new Error('Type de fichier non autorisé');
  }
  if (trimmed.length > MAX_CHAT_ATTACHMENT_DATA_CHARS) {
    throw new Error('Fichier trop volumineux (max 10 Mo)');
  }
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > CHAT_ATTACHMENT_MAX_FILE_BYTES) {
    throw new Error('Fichier trop volumineux (max 10 Mo)');
  }
  const isImage = mime in IMAGE_MIME_EXT;
  if (isImage && !validateImageMagicBytes(buffer, mime)) {
    throw new Error("Format d'image non reconnu ou corrompu");
  }
  if (!isImage && !validateNonImageMagicBytes(buffer, mime)) {
    throw new Error('Fichier corrompu ou type non conforme à son contenu');
  }

  const dir = uploadsDir();
  fs.mkdirSync(dir, { recursive: true });
  const id = crypto.randomBytes(12).toString('hex');
  const filename = `${id}.${ext}`;
  fs.writeFileSync(path.join(dir, filename), buffer);

  return { url: `/uploads/chat-attachments/${filename}`, mimeType: mime, size: buffer.length, isImage };
}

export function deleteChatAttachmentIfLocal(url: string | undefined): void {
  const trimmed = url?.trim();
  if (!trimmed || !UPLOADS_CHAT_ATTACHMENT_RE.test(trimmed)) return;
  const filePath = path.join(getPublicDir(), trimmed.replace(/^\//, ''));
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    /* best-effort */
  }
}
