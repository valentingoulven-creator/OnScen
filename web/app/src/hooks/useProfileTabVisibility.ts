import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { ProfileTab } from '../components/ProfileTabBar';

export type ProfileTabVisibility = {
  showReels: boolean;
  showCompositions: boolean;
  showProgrammation: boolean;
  showLives: boolean;
  /** false while loading visibility for a visited profile */
  ready: boolean;
};

const ALL_VISIBLE: ProfileTabVisibility = {
  showReels: true,
  showCompositions: true,
  showProgrammation: true,
  showLives: true,
  ready: true,
};

function reelHasPoster(reel: { posterUrl?: string }): boolean {
  return Boolean(reel.posterUrl?.trim());
}

export function useProfileTabVisibility(
  userId: string,
  options: { isSelf: boolean; token: string | null; canViewPrivateReels: boolean }
): ProfileTabVisibility {
  const { isSelf, token, canViewPrivateReels } = options;
  const [visibility, setVisibility] = useState<ProfileTabVisibility>(() =>
    isSelf ? ALL_VISIBLE : { ...ALL_VISIBLE, showReels: false, showCompositions: false, showProgrammation: false, showLives: false, ready: false }
  );

  useEffect(() => {
    if (isSelf) {
      setVisibility(ALL_VISIBLE);
      return;
    }
    if (!token) {
      setVisibility({
        showReels: false,
        showCompositions: false,
        showProgrammation: false,
        showLives: false,
        ready: true,
      });
      return;
    }

    let cancelled = false;
    setVisibility((v) => ({ ...v, ready: false }));

    Promise.all([
      api.getUserReels(token, userId),
      canViewPrivateReels ? api.getUserPrivateReels(token, userId) : Promise.resolve({ reels: [] }),
      api.getUserAlbums(token, userId),
      api.getFeedPosts(token, {
        eventsOnly: true,
        userEventsOnly: true,
        profileUserId: userId,
        limit: 1,
      }),
      api.getProfileTaggedStories(token, userId),
      api.getUserLives(token, userId),
    ])
      .then(([publicReels, privateReels, albumsRes, eventsRes, storiesRes, livesRes]) => {
        if (cancelled) return;
        const reels = [
          ...(publicReels.reels ?? []),
          ...(privateReels.reels ?? []),
        ].filter(reelHasPoster);
        const hasCompositions =
          (albumsRes.albums?.length ?? 0) > 0 || (albumsRes.looseTrackCount ?? 0) > 0;
        const hasProgrammation =
          (eventsRes.posts?.length ?? 0) > 0 || (storiesRes.stories?.length ?? 0) > 0;
        const hasLives = (livesRes.lives?.length ?? 0) > 0;
        setVisibility({
          showReels: reels.length > 0,
          showCompositions: hasCompositions,
          showProgrammation: hasProgrammation,
          showLives: hasLives,
          ready: true,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setVisibility({
          showReels: false,
          showCompositions: false,
          showProgrammation: false,
          showLives: false,
          ready: true,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [userId, isSelf, token, canViewPrivateReels]);

  return visibility;
}

export function isProfileTabVisible(
  tab: ProfileTab,
  isSelf: boolean,
  visibility: ProfileTabVisibility
): boolean {
  if (tab === 'profil') return true;
  if (isSelf) return true;
  if (!visibility.ready) return false;
  switch (tab) {
    case 'reels':
      return visibility.showReels;
    case 'compositions':
      return visibility.showCompositions;
    case 'programmation':
      return visibility.showProgrammation;
    case 'lives':
      return visibility.showLives;
    default:
      return false;
  }
}
