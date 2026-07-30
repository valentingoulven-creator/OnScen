/** Who may end the salon for everyone vs leave their own session only. */
export function resolveActiveSalonHostRole(params: {
  salon: { hostId: string } | null | undefined;
  userId: string;
  salonId: string;
  /** Client session hint before GET /salons/:id completes. */
  sessionIsHost?: boolean;
  /** /auth/me — salon the user hosts (not a listen-only session). */
  userHostedSalonId?: string | null;
}): boolean {
  if (params.salon) {
    return params.salon.hostId === params.userId;
  }
  if (params.sessionIsHost === true) return true;
  if (params.sessionIsHost === false) return false;
  return Boolean(
    params.userHostedSalonId != null && params.userHostedSalonId === params.salonId
  );
}
