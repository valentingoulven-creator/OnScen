/** listenersCount = auditeurs connectés (hôte exclu côté socket). */
export function formatSalonAudienceLabel(
  count: number,
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  const safe = Math.max(0, count);
  return t(safe === 1 ? 'salon.audience_one' : 'salon.audience_other', { count: safe });
}
