import type { SalonTrackProposal } from '../types';

/** Decode HTML entities sometimes present in YouTube/API titles (e.g. &amp; → &). */
export function decodeProposalDisplayText(text: string): string {
  if (!text || !text.includes('&')) return text;
  if (typeof document !== 'undefined') {
    const el = document.createElement('textarea');
    el.innerHTML = text;
    return el.value;
  }
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

export function sortSalonProposals(proposals: SalonTrackProposal[]): SalonTrackProposal[] {
  return [...proposals].sort((a, b) => {
    const upvoteDiff = (b.upvotes?.length ?? 0) - (a.upvotes?.length ?? 0);
    if (upvoteDiff !== 0) return upvoteDiff;
    return b.createdAt - a.createdAt;
  });
}
