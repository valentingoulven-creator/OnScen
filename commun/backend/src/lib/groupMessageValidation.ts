/** Refuse toute tentative client de forger un message système via le body HTTP. */
export function clientTriedForgedSystemMessage(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  if (b.kind === 'system') return true;
  if (typeof b.systemEvent === 'string' && b.systemEvent.length > 0) return true;
  if (b.systemMeta != null && typeof b.systemMeta === 'object') return true;
  return false;
}
