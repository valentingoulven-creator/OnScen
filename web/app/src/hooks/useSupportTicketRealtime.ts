import { useEffect } from 'react';
import { emitOnSocket, getSocket, onSocketConnect } from '../lib/socket';
import type { SupportContactMessage } from '../types';

export type SupportTicketUpdatedPayload = {
  message: SupportContactMessage;
};

/** Listen for support ticket updates delivered via the user's socket room. */
export function useSupportTicketUpdates(
  onUpdate: (message: SupportContactMessage) => void,
  enabled = true
): void {
  useEffect(() => {
    if (!enabled) return;
    const socket = getSocket();
    if (!socket) return;

    const handler = (payload: SupportTicketUpdatedPayload) => {
      if (payload?.message?.id) onUpdate(payload.message);
    };

    socket.on('support_ticket_updated', handler);
    return () => {
      socket.off('support_ticket_updated', handler);
    };
  }, [enabled, onUpdate]);
}

/** Join a support ticket room while its detail view is open; leave on close or unmount. */
export function useSupportTicketRoom(ticketId: string | null, enabled = true): void {
  useEffect(() => {
    if (!enabled || !ticketId) return;

    const join = () => {
      emitOnSocket('join_support_ticket', { ticketId });
    };

    join();
    const unsubConnect = onSocketConnect(join);

    return () => {
      emitOnSocket('leave_support_ticket', { ticketId });
      unsubConnect();
    };
  }, [enabled, ticketId]);
}
