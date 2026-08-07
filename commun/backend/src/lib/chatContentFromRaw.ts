import type { ChatModerationOptions } from './chatModerationPolicy';
import { prepareChatText } from './sanitizeUserText';

export function chatContentFromRaw(
  raw: string | undefined,
  options?: ChatModerationOptions
): { ok: true; content: string } | { ok: false; message: string } {
  const sliced = typeof raw === 'string' ? raw.slice(0, 2000) : '';
  const prep = prepareChatText(sliced, options);
  if (!prep.ok) return { ok: false, message: prep.message };
  return { ok: true, content: prep.text };
}
