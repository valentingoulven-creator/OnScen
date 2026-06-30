import {
  db,
  type Salon,
  type SalonTrackProposal,
  type UserComposition,
  type WeeklySongVote,
} from '../models/schema';

// ─── Week helpers ─────────────────────────────────────────────────────────────

/** Returns the Unix-ms timestamp for Monday 00:00:00.000 (local time) of the
 *  week containing `now`. Matches the "refresh every Monday" contract. */
export function getWeekStart(now = Date.now()): number {
  const d = new Date(now);
  const day = d.getDay(); // 0 = Sunday, 1 = Monday, …
  const daysBack = day === 0 ? 6 : day - 1;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysBack);
  return d.getTime();
}

// ─── Vote recording ───────────────────────────────────────────────────────────

/**
 * Record or retract a weekly upvote for a salon proposal.
 * Automatically purges entries older than 2 weeks to keep the array bounded.
 *
 * @param proposal  The target proposal (carries title / artist / urls)
 * @param salon     Parent salon (for salonId reference)
 * @param voterId   ID of the user toggling their vote
 * @param isAdding  true = adding vote, false = removing vote
 */
export function recordWeeklyVote(
  proposal: SalonTrackProposal,
  salon: Salon,
  voterId: string,
  isAdding: boolean
): void {
  const id = `${proposal.id}__${voterId}`;
  const now = Date.now();
  const weekStart = getWeekStart(now);
  // Purge votes older than 2 weeks to prevent unbounded growth.
  const twoWeeksAgo = weekStart - 14 * 24 * 60 * 60 * 1000;
  const keep = db.weeklyVotes.filter((v) => v.votedAt >= twoWeeksAgo);
  db.weeklyVotes.length = 0;
  db.weeklyVotes.push(...keep);

  const existingIdx = db.weeklyVotes.findIndex((v) => v.id === id);
  if (isAdding) {
    const entry: WeeklySongVote = {
      id,
      votedAt: now,
      weekStart,
      voterId,
      salonId: salon.id,
      proposalId: proposal.id,
      songTitle: proposal.title,
      songArtist: proposal.artist,
      youtubeUrl: proposal.youtubeUrl,
      proposerName: proposal.proposerName,
      sourceType: 'salon',
    };
    if (existingIdx >= 0) {
      db.weeklyVotes[existingIdx] = entry;
    } else {
      db.weeklyVotes.push(entry);
    }
  } else {
    if (existingIdx >= 0) db.weeklyVotes.splice(existingIdx, 1);
  }
}

/**
 * Record or retract a weekly upvote for a discographie composition.
 * Stored separately from salon votes (sourceType: 'composition').
 */
export function recordCompositionWeeklyVote(
  composition: UserComposition,
  voterId: string,
  isAdding: boolean
): void {
  const proposalId = `comp:${composition.id}`;
  const id = `${proposalId}__${voterId}`;
  const now = Date.now();
  const weekStart = getWeekStart(now);
  const twoWeeksAgo = weekStart - 14 * 24 * 60 * 60 * 1000;
  const keep = db.weeklyVotes.filter((v) => v.votedAt >= twoWeeksAgo);
  db.weeklyVotes.length = 0;
  db.weeklyVotes.push(...keep);

  const owner = db.users.get(composition.userId);
  const existingIdx = db.weeklyVotes.findIndex((v) => v.id === id);
  if (isAdding) {
    const entry: WeeklySongVote = {
      id,
      votedAt: now,
      weekStart,
      voterId,
      salonId: '',
      proposalId,
      songTitle: composition.title,
      songArtist: composition.artist ?? '',
      fileUrl: composition.fileUrl,
      proposerName: owner?.username ?? 'Artiste',
      sourceType: 'composition',
      compositionId: composition.id,
      compositionOwnerId: composition.userId,
    };
    if (existingIdx >= 0) {
      db.weeklyVotes[existingIdx] = entry;
    } else {
      db.weeklyVotes.push(entry);
    }
  } else if (existingIdx >= 0) {
    db.weeklyVotes.splice(existingIdx, 1);
  }
}

// ─── Query ────────────────────────────────────────────────────────────────────

export interface WeeklyTopSongResult {
  rank: number;
  proposalId: string;
  salonId: string;
  title: string;
  artist: string;
  youtubeUrl?: string;
  fileUrl?: string;
  proposerName: string;
  voteCount: number;
  weekStart: number;
  sourceType: 'salon' | 'composition';
  compositionId?: string;
  compositionOwnerId?: string;
}

function addWeeklyVoteToMap(
  byProposal: Map<string, { sample: WeeklySongVote; count: number }>,
  vote: WeeklySongVote
): void {
  const existing = byProposal.get(vote.proposalId);
  if (existing) {
    existing.count += 1;
  } else {
    byProposal.set(vote.proposalId, { sample: vote, count: 1 });
  }
}

/**
 * Returns the top-N songs by upvote count for the current week (Monday → Sunday).
 * Merges salon proposals and discographie compositions. Votes from previous weeks
 * are ignored at query time — no data is deleted here.
 */
export function getWeeklyTopSongs(limit = 10): WeeklyTopSongResult[] {
  const weekStart = getWeekStart();
  const thisWeek = db.weeklyVotes.filter((v) => v.votedAt >= weekStart);

  const byProposal = new Map<
    string,
    { sample: WeeklySongVote; count: number }
  >();
  for (const vote of thisWeek) {
    addWeeklyVoteToMap(byProposal, vote);
  }

  // Backfill composition upvotes cast this week before the weekly ledger existed.
  const recordedVoteIds = new Set(thisWeek.map((v) => v.id));
  for (const upvote of db.compositionUpvotes) {
    if (upvote.votedAt < weekStart) continue;
    const proposalId = `comp:${upvote.compositionId}`;
    const voteId = `${proposalId}__${upvote.userId}`;
    if (recordedVoteIds.has(voteId)) continue;
    recordedVoteIds.add(voteId);

    const composition = db.compositions.find((c) => c.id === upvote.compositionId);
    if (!composition) continue;

    const owner = db.users.get(composition.userId);
    addWeeklyVoteToMap(byProposal, {
      id: voteId,
      votedAt: upvote.votedAt,
      weekStart,
      voterId: upvote.userId,
      salonId: '',
      proposalId,
      songTitle: composition.title,
      songArtist: composition.artist ?? '',
      fileUrl: composition.fileUrl,
      proposerName: owner?.username ?? 'Artiste',
      sourceType: 'composition',
      compositionId: composition.id,
      compositionOwnerId: composition.userId,
    });
  }

  return [...byProposal.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, limit)
    .map(([proposalId, { sample, count }], index) => ({
      rank: index + 1,
      proposalId,
      salonId: sample.salonId,
      title: sample.songTitle,
      artist: sample.songArtist,
      youtubeUrl: sample.youtubeUrl,
      fileUrl: sample.fileUrl,
      proposerName: sample.proposerName,
      voteCount: count,
      weekStart,
      sourceType: sample.sourceType === 'composition' ? 'composition' : 'salon',
      compositionId: sample.compositionId,
      compositionOwnerId: sample.compositionOwnerId,
    }));
}
