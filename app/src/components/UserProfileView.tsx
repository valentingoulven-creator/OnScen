import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getUserProfilePhotos } from '../lib/profilePhotos';
import { isDicebearAvatarUrl } from '../lib/avatarUrl';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { useMatchCreated } from '../lib/useMatchCreated';
import { HostRatingBlock } from './HostRatingBlock';
import { ProfilePhotoGallery } from './ProfilePhotoGallery';
import { getViewableProfilePhotos, ProfilePhotoViewer } from './ProfilePhotoViewer';
import { formatCompactCount } from '../lib/formatCount';
import { resolveProfileLiveId } from '../lib/profileLive';
import { FollowUserButton } from './FollowUserButton';
import { CreatorSubscribeSheet } from './CreatorSubscribeSheet';
import { ProfileCurrentListening } from './ProfileCurrentListening';
import { CompactTagChips } from './CompactTagChips';
import { ProfileHeaderSection } from './ProfileHeaderSection';
import { canSendHeart, heartBlockReasonKeys, heartDisabledReason, type HeartBlockReasonKey } from '../lib/canSendHeart';
import type {
  CurrentListening,
  MatchStatus,
  MusicMatch,
  NearbyPerson,
  User,
} from '../types';

interface UserProfileViewProps {
  userId: string;
  preview?: NearbyPerson;
  onOpenLive?: (liveId: string) => void;
  /** Salon actif (preview carte ou profil API) remonté au parent pour le pied de page fixe. */
  onSalonInfo?: (info: { salonId: string; salonTitle?: string } | null) => void;
  /** Ouvrir la conversation DM avec cet utilisateur. */
  onOpenDm?: (userId: string) => void;
}

export function UserProfileView({
  userId,
  preview,
  onOpenLive,
  onSalonInfo,
  onOpenDm,
}: UserProfileViewProps) {
  const { t } = useTranslation();
  const { user: me, token } = useAuth();
  const [profile, setProfile] = useState<User | null>(null);
  const [matchStatus, setMatchStatus] = useState<MatchStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [heartSent, setHeartSent] = useState(false);
  const [justMatched, setJustMatched] = useState<MusicMatch | null>(null);
  const [heartToast, setHeartToast] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const [subscribeToast, setSubscribeToast] = useState<string | null>(null);
  const [photoViewerIndex, setPhotoViewerIndex] = useState<number | null>(null);

  const isSelf = me?.id === userId;
  const isMatched = Boolean(matchStatus?.matched || justMatched);
  const heartAllowed = canSendHeart(me, profile);
  const heartBlockReason = heartDisabledReason(me, profile);
  const heartBlockMessages = useMemo(() => {
    const keyToI18n: Record<HeartBlockReasonKey, string> = {
      login: 'profile.heartBlockedLogin',
      viewerNotValidated: 'profile.heartBlockedViewerNotValidated',
      profileNotValidated: 'profile.heartBlockedProfileNotValidated',
      viewerUnderAge: 'profile.heartBlockedViewerUnderAge',
      profileUnderAge: 'profile.heartBlockedProfileUnderAge',
      viewerNotSingle: 'profile.heartBlockedViewerNotSingle',
      profileNotSingle: 'profile.heartBlockedProfileNotSingle',
    };
    return heartBlockReasonKeys(me, profile).map((key) => t(keyToI18n[key]));
  }, [me, profile, t]);
  const isMutualFollow = Boolean(profile?.isFollowing && profile?.isFollowingMe);

  useEffect(() => {
    if (!token) return;
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

  const applyRemoteMatch = useCallback(
    (match: MusicMatch) => {
      setJustMatched(match);
      setHeartSent(true);
      setMatchStatus((s) =>
        s
          ? { ...s, matched: true, match, iSentHeart: true, theySentHeart: true }
          : { matched: true, match, iSentHeart: true, theySentHeart: true }
      );
    },
    []
  );

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

  useEffect(() => {
    if (!onSalonInfo) return;
    const salonId = profile?.salonId ?? preview?.salonId;
    if (!salonId) {
      onSalonInfo(null);
      return;
    }
    const salonTitle = profile?.salonTitle ?? preview?.salonTitle;
    onSalonInfo({ salonId, salonTitle });
  }, [
    onSalonInfo,
    preview?.salonId,
    preview?.salonTitle,
    profile?.salonId,
    profile?.salonTitle,
  ]);

  const photos = profile
    ? getUserProfilePhotos(profile)
    : preview?.avatarUrl && !isDicebearAvatarUrl(preview.avatarUrl)
      ? [preview.avatarUrl]
      : [];
  const viewablePhotos = getViewableProfilePhotos(photos);
  const avatarUrl =
    photos[0]?.trim() || profile?.avatarUrl || preview?.avatarUrl || '';
  const viewerPhotos =
    viewablePhotos.length > 0 ? viewablePhotos : avatarUrl ? [avatarUrl] : [];

  const openPhotoViewer = (index: number) => {
    if (viewerPhotos.length === 0) return;
    setPhotoViewerIndex(Math.max(0, Math.min(index, viewerPhotos.length - 1)));
  };

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

  const displayName = profile?.username ?? preview?.username ?? 'Utilisateur';
  const displayColor = profile?.usernameColor ?? preview?.usernameColor;
  const displayWaveFrom = profile?.usernameWaveFrom ?? preview?.usernameWaveFrom;
  const displayWaveTo = profile?.usernameWaveTo ?? preview?.usernameWaveTo;
  const isLiveHost = Boolean(profile?.isLive || preview?.isLive);
  const liveId = resolveProfileLiveId(profile, preview);
  const liveViewers =
    profile?.liveViewersCount ?? preview?.liveViewersCount;
  const currentListening: CurrentListening | undefined =
    profile?.currentListening ?? preview?.currentListening;

  const heartHint = () => {
    if (isMatched) return null;
    if (matchStatus?.theySentHeart && !heartSent) {
      return (
        <p className="text-xs text-center text-pink-300 bg-pink-950/30 border border-pink-500/30 rounded-xl px-3 py-2">
          Cette personne vous a envoyé un ♥ — renvoyez un cœur pour créer un match !
        </p>
      );
    }
    if (heartSent && !justMatched) {
      return (
        <p className="text-xs text-center text-gray-500">
          Cœur envoyé. Vous serez notifiés en cas de match musical.
        </p>
      );
    }
    return null;
  };

  if (loading) {
    return <p className="p-8 text-center text-gray-500 text-sm">Chargement du profil...</p>;
  }

  if (error && !profile) {
    return <p className="p-8 text-center text-red-400 text-sm">{error}</p>;
  }

  if (!profile && !preview) {
    return null;
  }

  const showHostRating = Boolean(
    profile &&
      (profile.listeningRole === 'host' ||
        profile.listeningRole === 'les_deux' ||
        (profile.stats?.salonsHosted ?? 0) > 0)
  );

  const publicStatsRow = profile ? (
    <div className="flex justify-center gap-5 sm:gap-8 mt-3 w-full">
      {[
        {
          value: formatCompactCount(profile.favoritesCount ?? 0),
          label: 'Favoris',
        },
        {
          value: formatCompactCount(profile.subscriberCount ?? 0),
          label: 'Abonnés',
        },
        {
          value: formatCompactCount(profile.stats?.salonsHosted ?? 0),
          label: 'Salons',
        },
      ].map((item) => (
        <div key={item.label} className="text-center min-w-[4.5rem]">
          <p className="text-base font-bold text-white tabular-nums">{item.value}</p>
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">{item.label}</p>
        </div>
      ))}
    </div>
  ) : null;

  return (
    <div className="space-y-5 max-w-lg mx-auto w-full bg-[#0b0b0f]">
      {(isMatched || justMatched) && (
        <div className="mx-4 text-center p-4 rounded-xl bg-gradient-to-br from-pink-900/50 to-purple-900/40 border border-pink-500/40">
          <p className="text-3xl mb-1">💞</p>
          <p className="text-lg font-bold text-white">Match musical !</p>
          <p className="text-sm text-pink-200 mt-1">
            Vous et {displayName} partagez les mêmes vibes
          </p>
        </div>
      )}

      <ProfileHeaderSection
        variant="compact"
        userId={userId}
        username={displayName}
        usernameColor={displayColor}
        usernameWaveFrom={displayWaveFrom}
        usernameWaveTo={displayWaveTo}
        avatarUrl={avatarUrl}
        profileType={profile?.profileType}
        city={profile?.city}
        birthDate={profile?.birthDate}
        age={profile?.age}
        hideBirthDateOnProfile={profile?.hideBirthDateOnProfile}
        relationshipStatus={
          profile?.relationshipStatus === 'autre' ? undefined : profile?.relationshipStatus
        }
        hasPhotoGallery={viewerPhotos.length > 1}
        onAvatarClick={viewerPhotos.length > 0 ? () => openPhotoViewer(0) : undefined}
        isLive={isLiveHost}
        liveViewersCount={liveViewers}
        isSupporter={profile?.isSupporter}
        supporterTier={profile?.supporterTier}
        statsRow={publicStatsRow}
        bio={
          profile?.bio ? (
            <p className="whitespace-pre-wrap break-words">{profile.bio}</p>
          ) : undefined
        }
        extraMeta={
          preview ? (
            <p className="text-[11px] text-gray-500 mt-1">
              {preview.distanceKm != null
                ? `${preview.distanceKm} km · à proximité`
                : preview.city
                  ? `${preview.city} · à proximité`
                  : 'À proximité'}
            </p>
          ) : undefined
        }
        hostRatingSlot={
          showHostRating ? (
            <HostRatingBlock
              hostId={userId}
              hostName={displayName}
              averageOnly
              initialRating={profile?.hostRating}
            />
          ) : undefined
        }
      />

      <div className="px-4 space-y-5 pb-8">

      {currentListening && <ProfileCurrentListening listening={currentListening} />}

      {photos.length > 1 && (
        <section>
          <div
            className={
              profile?.isLive || preview?.isLive
                ? 'p-0.5 bg-gradient-to-br from-red-500 via-rose-500 to-red-600 shadow-[0_0_16px_rgba(239,68,68,0.45)]'
                : ''
            }
          >
            <ProfilePhotoGallery
              photos={photos}
              fallbackSeed={userId}
              variant="bare"
              galleryOnly
              onPhotoClick={viewerPhotos.length > 0 ? openPhotoViewer : undefined}
            />
          </div>
          {isLiveHost && (
            <p className="text-center text-xs text-red-400 font-bold mt-2">
              🔴 En live
              {liveViewers != null && (
                <>
                  {' '}
                  · {formatCompactCount(liveViewers)} spectateurs
                </>
              )}
            </p>
          )}
        </section>
      )}

      {isLiveHost && liveId && onOpenLive && (
        <button
          type="button"
          onClick={() => onOpenLive(liveId)}
          className="w-full py-3.5 rounded-xl font-bold text-white flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 shadow-lg shadow-red-900/40 transition active:scale-[0.99]"
        >
          <span className="text-lg" aria-hidden>
            🔴
          </span>
          Rejoindre le live
          {liveViewers != null && (
            <span className="text-sm font-semibold text-red-100/90">
              · {formatCompactCount(liveViewers)} spectateurs
            </span>
          )}
        </button>
      )}

      <CompactTagChips
        interests={profile?.interests ?? []}
        genres={profile?.favoriteGenres ?? []}
        artists={profile?.favoriteArtists ?? []}
      />

      {heartHint()}

      {heartToast && (
        <p className="text-sm text-center font-semibold text-pink-200 bg-pink-950/40 border border-pink-500/40 rounded-xl px-3 py-2.5">
          Cœur envoyé ! 💜
        </p>
      )}

      {!isSelf && (
        <FollowUserButton
          userId={userId}
          username={displayName}
          initialFollowing={profile?.isFollowing}
          onFollowingChange={(following) =>
            setProfile((p) => (p ? { ...p, isFollowing: following } : p))
          }
        />
      )}

      {!isSelf && onOpenDm && (
        isMutualFollow ? (
          <button
            type="button"
            onClick={() => onOpenDm(userId)}
            className="w-full py-2.5 rounded-xl text-sm font-bold border border-purple-500/50 bg-purple-600/80 hover:bg-purple-600 text-white transition"
          >
            {t('profile.messageButton')}
          </button>
        ) : (
          <button
            type="button"
            disabled
            title={t('profile.messageButtonDisabledTitle')}
            className="w-full py-2.5 rounded-xl text-sm font-bold border border-[#2d2d3d] bg-[#1a1a26]/90 text-gray-500 cursor-not-allowed"
          >
            {t('profile.messageButtonDisabled')}
          </button>
        )
      )}

      {!isSelf && token && profile?.monetizationEligible !== false && (
        <button
          type="button"
          onClick={() => setSubscribeOpen(true)}
          className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition ${
            profile?.isSupporter
              ? 'bg-amber-900/40 border border-amber-500/40 text-amber-100'
              : 'bg-purple-700/80 hover:bg-purple-600 text-white'
          }`}
        >
          <span aria-hidden>⭐</span>
          {profile?.isSupporter ? 'Abonnement actif — modifier' : 'S’abonner au créateur'}
        </button>
      )}

      {subscribeToast && (
        <p className="text-xs text-center text-amber-200 bg-amber-950/40 border border-amber-500/30 rounded-lg px-3 py-2">
          {subscribeToast}
        </p>
      )}

      {token && profile?.monetizationEligible !== false && (
        <CreatorSubscribeSheet
          open={subscribeOpen}
          onClose={() => setSubscribeOpen(false)}
          token={token}
          userAge={me?.age}
          creatorId={userId}
          creatorName={displayName}
          targetType="creator"
          onSuccess={(msg) => {
            setSubscribeToast(msg);
            setProfile((p) => (p ? { ...p, isSupporter: true } : p));
            window.setTimeout(() => setSubscribeToast(null), 4000);
          }}
        />
      )}

      {!isSelf && !isMatched && (
        <div>
          <button
          type="button"
          onClick={sendHeart}
          disabled={sending || heartSent || !heartAllowed}
          title={!heartAllowed && !heartSent ? (heartBlockReason ?? undefined) : undefined}
          className={`w-full py-3.5 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition ${
            heartSent
              ? 'bg-pink-900/40 border border-pink-500/40 text-pink-200'
              : matchStatus?.theySentHeart
                ? 'bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 shadow-lg shadow-pink-900/40 animate-pulse'
                : 'bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 shadow-lg shadow-pink-900/30'
          } disabled:opacity-60`}
        >
          <span className="text-xl">{heartSent ? '💗' : '♥'}</span>
          {heartSent
            ? 'Cœur envoyé'
            : sending
              ? 'Envoi...'
              : matchStatus?.theySentHeart
                ? 'Renvoyer un cœur — Match !'
                : 'Envoyer un cœur'}
          </button>
          {heartBlockMessages.length > 0 && !heartSent && (
            <div className="mt-1 space-y-0.5 px-1">
              {heartBlockMessages.map((message) => (
                <p key={message} className="text-[10px] text-center text-gray-500 leading-snug">
                  {message}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {error && profile && <p className="text-xs text-red-400 text-center">{error}</p>}
      </div>

      {photoViewerIndex !== null && viewerPhotos.length > 0 && (
        <ProfilePhotoViewer
          photos={viewerPhotos}
          initialIndex={photoViewerIndex}
          onClose={() => setPhotoViewerIndex(null)}
        />
      )}
    </div>
  );
}
