import { useCallback, useEffect, useState } from 'react';
import { isDicebearAvatarUrl } from '../lib/avatarUrl';
import { getUserProfilePhotos } from '../lib/profilePhotos';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { useMatchCreated } from '../lib/useMatchCreated';
import { getViewableProfilePhotos } from '../components/ProfilePhotoViewer';
import { canSendHeart, heartDisabledReason, isSingleForHeart, userMeetsHeartAge } from '../lib/canSendHeart';
import type { MatchStatus, MusicMatch, NearbyPerson, User } from '../types';

export function useUserProfile(userId: string, preview?: NearbyPerson) {
  const { user: me, token } = useAuth();
  const [profile, setProfile] = useState<User | null>(null);
  const [matchStatus, setMatchStatus] = useState<MatchStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [heartSent, setHeartSent] = useState(false);
  const [justMatched, setJustMatched] = useState<MusicMatch | null>(null);
  const [heartToast, setHeartToast] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSelf = me?.id === userId;
  const isMatched = Boolean(matchStatus?.matched || justMatched);
  const heartAllowed = canSendHeart(me, profile);
  const heartBlockReason = heartDisabledReason(me, profile);
  const profileIsSingle = isSingleForHeart(profile);
  const profileMeetsAge = userMeetsHeartAge(profile);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    Promise.all([api.getUserProfile(token, userId), api.getMatchStatus(token, userId)])
      .then(([profileRes, statusRes]) => {
        setProfile(profileRes.user);
        setMatchStatus(statusRes);
        setHeartSent(statusRes.iSentHeart);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Profil introuvable'))
      .finally(() => setLoading(false));
  }, [token, userId]);

  const applyRemoteMatch = useCallback((match: MusicMatch) => {
    setJustMatched(match);
    setHeartSent(true);
    setMatchStatus((s) =>
      s
        ? { ...s, matched: true, match, iSentHeart: true, theySentHeart: true }
        : { matched: true, match, iSentHeart: true, theySentHeart: true }
    );
  }, []);

  useMatchCreated(
    (payload) => {
      if (payload.otherUser.id !== userId) return;
      applyRemoteMatch({
        id: payload.matchId,
        createdAt: payload.createdAt,
        otherUser: payload.otherUser,
      });
    },
    Boolean(token && !isSelf && !isMatched)
  );

  const photos = profile
    ? getUserProfilePhotos(profile)
    : preview?.avatarUrl && !isDicebearAvatarUrl(preview.avatarUrl)
      ? [preview.avatarUrl]
      : [];
  const viewablePhotos = getViewableProfilePhotos(photos);
  const avatarUrl = photos[0]?.trim() || profile?.avatarUrl || preview?.avatarUrl || '';
  const viewerPhotos =
    viewablePhotos.length > 0 ? viewablePhotos : avatarUrl ? [avatarUrl] : [];

  const displayName = profile?.username ?? preview?.username ?? 'Utilisateur';

  const sendHeart = async () => {
    if (!token || isSelf || sending || heartSent || isMatched || !heartAllowed) return;
    setSending(true);
    setError(null);
    try {
      const r = await api.sendHeart(token, userId);
      setHeartSent(true);
      if (r.matched && r.match) {
        applyRemoteMatch(r.match);
      } else {
        setMatchStatus((s) => (s ? { ...s, iSentHeart: true } : null));
        setHeartToast(true);
        window.setTimeout(() => setHeartToast(false), 3500);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setSending(false);
    }
  };

  const updateProfile = useCallback((patch: Partial<User> | ((prev: User | null) => User | null)) => {
    setProfile((prev) => {
      if (typeof patch === 'function') return patch(prev);
      return prev ? { ...prev, ...patch } : prev;
    });
  }, []);

  return {
    me,
    token,
    profile,
    setProfile: updateProfile,
    matchStatus,
    loading,
    sending,
    heartSent,
    justMatched,
    heartToast,
    error,
    setError,
    isSelf,
    isMatched,
    heartAllowed,
    heartBlockReason,
    profileIsSingle,
    profileMeetsAge,
    photos,
    viewablePhotos,
    avatarUrl,
    viewerPhotos,
    displayName,
    sendHeart,
  };
}
