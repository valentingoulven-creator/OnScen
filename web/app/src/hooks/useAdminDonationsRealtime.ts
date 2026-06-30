import { useEffect } from 'react';
import { getSocket } from '../lib/socket';
import type { AdminDonationEntry } from '../types';

export type AdminDonationRecordedPayload = {
  entry: AdminDonationEntry;
};

export function useAdminDonationUpdates(
  onDonation: (entry: AdminDonationEntry) => void,
  enabled = true
): void {
  useEffect(() => {
    if (!enabled) return;
    const socket = getSocket();
    if (!socket) return;

    const handler = (payload: AdminDonationRecordedPayload) => {
      if (payload?.entry?.id) onDonation(payload.entry);
    };

    socket.on('admin_donation_recorded', handler);
    return () => {
      socket.off('admin_donation_recorded', handler);
    };
  }, [enabled, onDonation]);
}
