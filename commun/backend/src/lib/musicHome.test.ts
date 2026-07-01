import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db, type User, type UserAlbum, type UserComposition, type UserReel } from '../models/schema';
import { buildMusicHome } from './musicHome';
import { getWeekStart, getWeeklyCompositionUpvoteCounts, recordReelWeeklyVote } from './weeklyVotes';

function seedUser(id: string, username: string): User {
  return {
    id,
    username,
    email: `${id}@test.local`,
    passwordHash: 'x',
    meloCoins: 0,
    isGhostMode: false,
    lastSeenAt: Date.now(),
  };
}

describe('musicHome weeklyTrend', () => {
  const weekStart = getWeekStart();
  const now = weekStart + 60_000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    db.users.clear();
    db.albums.length = 0;
    db.compositions.length = 0;
    db.compositionUpvotes.length = 0;
    db.weeklyVotes.length = 0;
    db.users.set('artist', seedUser('artist', 'artist_one'));
    db.users.set('fan', seedUser('fan', 'fan_one'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts composition upvotes cast during the current week only', () => {
    const track: UserComposition = {
      id: 'comp_hot',
      userId: 'artist',
      title: 'Hit',
      fileUrl: '/uploads/hit.mp3',
      createdAt: now - 86400000,
    };
    db.compositions.push(track);
    db.compositionUpvotes.push(
      { compositionId: 'comp_hot', userId: 'fan', votedAt: now },
      { compositionId: 'comp_hot', userId: 'artist', votedAt: weekStart - 1000 },
    );

    const counts = getWeeklyCompositionUpvoteCounts();
    expect(counts.get('comp_hot')).toBe(1);
  });

  it('ranks weeklyTrend tracks and albums by upvotes this week', () => {
    const album: UserAlbum = {
      id: 'album_1',
      userId: 'artist',
      title: 'Album A',
      createdAt: now,
      updatedAt: now,
    };
    db.albums.push(album);
    db.compositions.push(
      {
        id: 'comp_a',
        userId: 'artist',
        albumId: 'album_1',
        title: 'Track A',
        fileUrl: '/a.mp3',
        createdAt: now,
      },
      {
        id: 'comp_b',
        userId: 'artist',
        title: 'Track B',
        fileUrl: '/b.mp3',
        createdAt: now,
      },
    );
    db.compositionUpvotes.push(
      { compositionId: 'comp_a', userId: 'fan', votedAt: now },
      { compositionId: 'comp_a', userId: 'artist', votedAt: now + 1000 },
      { compositionId: 'comp_b', userId: 'fan', votedAt: now },
    );

    const home = buildMusicHome('fan');
    expect(home.weeklyTrend.weekStart).toBe(weekStart);
    expect(home.weeklyTrend.tracks.map((t) => t.id)).toEqual(['comp_a', 'comp_b']);
    expect(home.weeklyTrend.tracks[0]?.upvoteCount).toBe(2);
    expect(home.weeklyTrend.albums[0]?.id).toBe('album_1');
  });

  it('ranks weeklyTrend reels by hearts this week (max 10)', () => {
    const reel: UserReel = {
      id: 'reel_hot',
      authorId: 'artist',
      title: 'Reel viral',
      artist: 'artist_one',
      genre: 'electro',
      mediaType: 'video',
      videoUrl: 'https://cdn.test/reel.mp4',
      posterUrl: 'https://cdn.test/poster.jpg',
      createdAt: now,
      visibility: 'public',
    };
    db.userReels.push(reel);
    recordReelWeeklyVote(reel, 'fan', true);
    recordReelWeeklyVote(reel, 'artist', true);

    const home = buildMusicHome('fan');
    expect(home.weeklyTrend.reels).toHaveLength(1);
    expect(home.weeklyTrend.reels[0]?.id).toBe('reel_hot');
    expect(home.weeklyTrend.reels[0]?.weeklyUpvoteCount).toBe(2);
  });
});
