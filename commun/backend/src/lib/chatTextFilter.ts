import { applyChatModerationPolicy } from './chatModerationPolicy';

/** @deprecated Préférer prepareChatText — ne bloque pas, masque seulement si appelé sans policy block path. */
export function maskProfanity(input: string): string {
  const result = applyChatModerationPolicy(input);
  if (result.blocked) return input.replace(/\S/g, '*');
  return result.text;
}
