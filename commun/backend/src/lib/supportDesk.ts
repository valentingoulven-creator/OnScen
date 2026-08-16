import type { SupportContactStatus } from '../models/schema';

export function canAdminReplyToTicket(status: SupportContactStatus): boolean {
  return status !== 'resolved';
}

export function canResolveTicket(status: SupportContactStatus): boolean {
  return status !== 'resolved';
}

export function canReopenTicket(status: SupportContactStatus): boolean {
  return status === 'resolved';
}
