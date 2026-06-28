import type { Gift } from '../models/schema';
import { db } from '../models/schema';
import { isAccessAdmin } from './accessControl';
import { mapGiftToAdminDonationEntry, type AdminDonationEntry } from './donationsHistory';
import { getIo } from './ioInstance';

export type AdminDonationRecordedPayload = {
  entry: AdminDonationEntry;
};

export function broadcastAdminDonationRecorded(gift: Gift): void {
  const entry = mapGiftToAdminDonationEntry(gift);
  if (!entry) return;

  const io = getIo();
  if (!io) return;

  const payload: AdminDonationRecordedPayload = { entry };
  for (const admin of db.users.values()) {
    if (!isAccessAdmin(admin)) continue;
    io.to(`user_${admin.id}`).emit('admin_donation_recorded', payload);
  }
}
