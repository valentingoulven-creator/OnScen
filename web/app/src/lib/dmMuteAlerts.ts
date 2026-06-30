/** Indique si un message entrant doit déclencher toast / badge local (hors thread ouvert). */
export function shouldAlertForIncomingDm(
  mutedPeerIds: ReadonlySet<string>,
  senderId: string,
  inOpenThread: boolean
): boolean {
  if (inOpenThread) return false;
  return !mutedPeerIds.has(senderId);
}
