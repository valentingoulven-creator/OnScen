import type { SalonTrackProposal } from '../types';

export function sortSalonProposals(proposals: SalonTrackProposal[]): SalonTrackProposal[] {
  return [...proposals].sort((a, b) => {
    const upvoteDiff = (b.upvotes?.length ?? 0) - (a.upvotes?.length ?? 0);
    if (upvoteDiff !== 0) return upvoteDiff;
    return b.createdAt - a.createdAt;
  });
}
