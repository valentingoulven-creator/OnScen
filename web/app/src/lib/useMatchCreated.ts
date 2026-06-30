import { useEffect } from 'react';
import { getSocket } from './socket';

export interface MatchCreatedPayload {
  matchId: string;
  createdAt: number;
  otherUser: { id: string; username: string; avatarUrl?: string };
  viewerId: string;
}

/** Real-time mutual match (second heart) — complements persisted notifications. */
export function useMatchCreated(
  onMatch: (payload: MatchCreatedPayload) => void,
  enabled = true
): void {
  useEffect(() => {
    if (!enabled) return;
    const socket = getSocket();
    if (!socket) return;
    const handler = (payload: MatchCreatedPayload) => onMatch(payload);
    socket.on('match_created', handler);
    return () => {
      socket.off('match_created', handler);
    };
  }, [onMatch, enabled]);
}
