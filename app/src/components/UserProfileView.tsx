import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { computeAgeFromBirthDate, formatBirthDate } from '../lib/profileAge';
import { getUserProfilePhotos } from '../lib/profilePhotos';
import { isDicebearAvatarUrl } from '../lib/avatarUrl';
import {
  getRelationshipDisplayLabel,
  getRelationshipEmoji,
} from '../lib/relationshipStatus';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { useMatchCreated } from '../lib/useMatchCreated';
import { HostRatingBlock } from './HostRatingBlock';
import { ProfilePhotoGallery } from './ProfilePhotoGallery';
import { getViewableProfilePhotos, ProfilePhotoViewer } from './ProfilePhotoViewer';
import { PublicProfilePhotoHero } from './PublicProfilePhotoHero';
import { formatCompactCount } from '../lib/formatCount';
import { resolveProfileLiveId } from '../lib/profileLive';
import { FollowUserButton } from './FollowUserButton';
import { ProfileCurrentListening } from './ProfileCurrentListening';
import { CompactTagChips } from './CompactTagChips';
import { ProfileIdentityLines } from './ProfileIdentityLines';
import { UsernameDisplay } from './UsernameDisplay';
import { UserAvatarOnline } from './UserAvatarOnline';
import { canJoinSalonAsParticipant, salonParticipantAccessMessageKey } from '../lib/platformConnect';
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
  /** Ouvre le salon affiché dans « En écoute ». */
  onOpenSalon?: (salonId: string, salonTitle?: string, isHost?: boolean) => void;
  /** Ouvrir la conversation DM avec cet utilisateur. */
  onOpenDm?: (userId: string) => void;
}

export function UserProfileView({
  userId,
  preview,
  onOpenLive,
  onSalonInfo,
  onOpenSalon,
  onOpenDm,
}: UserProfileViewProps) {
  const { t, i18n } = useTranslation();
  const { user: me, token } = useAuth();
  const [profile, setProfile] = useState<User | null>(null);
  const [matchStatus, setMatchStatus] = useState<MatchStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [heartSent, setHeartSent] = useState(false);
  const [justMatched, setJustMatched] = useState<MusicMatch | null>(null);
  const [heartToast, setHeartToast] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [salonGateToast, setSalonGateToast] = useState<string | null>(null);
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
  const activeSalonId = profile?.salonId ?? preview?.salonId;
  const activeSalonTitle = profile?.salonTitle ?? preview?.salonTitle;
  const isSalonHost = isSelf;

  const openActiveSalon = useCallback(() => {
    if (!activeSalonId || !onOpenSalon || !currentListening) return;
    if (
      !canJoinSalonAsParticipant(
        currentListening.platform,
        me?.connectedPlatforms,
        isSalonHost
      )
    ) {
      setSalonGateToast(t(salonParticipantAccessMessageKey(currentListening.platform)));
      window.setTimeout(() => setSalonGateToast(null), 3500);
      return;
    }
    onOpenSalon(activeSalonId, activeSalonTitle, isSalonHost);
  }, [
    activeSalonId,
    activeSalonTitle,
    currentListening,
    isSalonHost,
    me?.connectedPlatforms,
    onOpenSalon,
    t,
  ]);

  const heartHint = () => {
    if (isMatched) return null;
    if (matchStatus?.theySentHeart && !heartSent) {
      return (
        <p className="text-xs text-pink-300 bg-pink-950/30 border border-pink-500/30 rounded-xl px-3 py-2">
          Cette personne vous a envoyé un ♥ — renvoyez un cœur pour créer un match !
        </p>
      );
    }
    if (heartSent && !justMatched) {
      return (
        <p className="text-xs text-gray-500">
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

  const birthDateTrimmed = profile?.birthDate?.trim() ?? '';
  const resolvedAge =
    profile?.age ?? (birthDateTrimmed ? computeAgeFromBirthDate(birthDateTrimmed) : null);
  const showFullBirthDate = Boolean(birthDateTrimmed) && !profile?.hideBirthDateOnProfile;
  const relationshipStatus =
    profile?.relationshipStatus === 'autre' ? undefined : profile?.relationshipStatus;

  const relationshipLabels = {
    celibataire: t('profile.relationshipSingle'),
    en_couple: t('profile.relationshipCouple'),
  } as const;

  const statsItems = profile
    ? [
        { value: formatCompactCount(profile.favoritesCount ?? 0), label: 'Favoris' },
        { value: formatCompactCount(profile.subscriberCount ?? 0), label: 'Abonnés' },
        { value: formatCompactCount(profile.stats?.salonsHosted ?? 0), label: 'Salons' },
      ]
    : [];

  const hasPhotoGallery = viewerPhotos.length > 1;

  return (
    <div className="w-full bg-[#0b0b0f] pb-8">
      {(isMatched || justMatched) && (
        <div className="mx-4 mt-4 text-center p-4 rounded-xl bg-gradient-to-br from-pink-900/50 to-purple-900/40 border border-pink-500/40">
          <p className="text-3xl mb-1">💞</p>
          <p className="text-lg font-bold text-white">Match musical !</p>
          <p className="text-sm text-pink-200 mt-1">
            Vous et {displayName} partagez les mêmes vibes
          </p>
        </div>
      )}

      {/* Hero photos + follow */}
      <div className="relative">
        <PublicProfilePhotoHero
          photos={viewerPhotos}
          isLive={isLiveHost}
          onPhotoClick={viewerPhotos.length > 0 ? openPhotoViewer : undefined}
        />
        {!isSelf && (
          <div className="absolute top-3 right-3 z-20">
            <FollowUserButton
              userId={userId}
              username={displayName}
              initialFollowing={profile?.isFollowing}
              compact
              onFollowingChange={(following) =>
                setProfile((p) => (p ? { ...p, isFollowing: following } : p))
              }
            />
          </div>
        )}
      </div>

      {/* Identity row — avatar chevauche le hero */}
      <div className="px-4 -mt-10 sm:-mt-11 relative z-10">
        <div className="flex items-end gap-3 sm:gap-4">
          {viewerPhotos.length > 0 ? (
            <button
              type="button"
              onClick={() => openPhotoViewer(0)}
              className={`shrink-0 rounded-full ${
                hasPhotoGallery
                  ? 'p-[3px] bg-gradient-to-tr from-purple-500 via-pink-500 to-purple-400 shadow-lg shadow-purple-900/50'
                  : 'ring-2 ring-[#1e1e2f]'
              } cursor-pointer hover:opacity-90 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500`}
              aria-label="Voir les photos du profil"
            >
              <div className="rounded-full ring-[3px] ring-[#0b0b0f] bg-[#0b0b0f]">
                <UserAvatarOnline
                  userId={userId}
                  username={displayName}
                  avatarUrl={avatarUrl}
                  size="profile"
                  isLive={isLiveHost}
                  liveViewersCount={liveViewers}
                />
              </div>
            </button>
          ) : (
            <div
              className={`shrink-0 rounded-full ring-[3px] ring-[#0b0b0f] bg-[#0b0b0f] ${
                hasPhotoGallery
                  ? 'p-[3px] bg-gradient-to-tr from-purple-500 via-pink-500 to-purple-400'
                  : ''
              }`}
            >
              <UserAvatarOnline
                userId={userId}
                username={displayName}
                avatarUrl={avatarUrl}
                size="profile"
                isLive={isLiveHost}
                liveViewersCount={liveViewers}
              />
            </div>
          )}

          <div className="min-w-0 flex-1 pb-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <UsernameDisplay
                as="h2"
                username={displayName}
                usernameColor={displayColor}
                usernameWaveFrom={displayWaveFrom}
                usernameWaveTo={displayWaveTo}
                className="text-lg sm:text-xl font-extrabold leading-tight truncate"
              />
              {showHostRating && profile ? (
                <HostRatingBlock
                  hostId={userId}
                  hostName={displayName}
                  averageOnly
                  initialRating={profile.hostRating}
                />
              ) : null}
            </div>
            <ProfileIdentityLines profileType={profile?.profileType} className="mt-0.5" />
          </div>
        </div>

        {/* Meta chips */}
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-[11px]">
          {profile?.city?.trim() ? (
            <span className="inline-flex items-center gap-0.5 text-gray-400">
              📍 {profile.city.trim()}
            </span>
          ) : null}
          {showFullBirthDate ? (
            <span className="inline-flex items-center gap-0.5 text-gray-400">
              🎂 {formatBirthDate(birthDateTrimmed, i18n.language) ?? birthDateTrimmed}
            </span>
          ) : resolvedAge != null ? (
            <span className="inline-flex items-center gap-0.5 text-gray-400">
              🎂 {resolvedAge} ans
            </span>
          ) : null}
          {relationshipStatus ? (
            <span className="inline-flex items-center gap-0.5 text-pink-300/90">
              {getRelationshipEmoji(relationshipStatus)}{' '}
              {getRelationshipDisplayLabel(
                relationshipStatus,
                profile?.relationshipStatusCustom,
                relationshipLabels
              )}
            </span>
          ) : null}
          {profile?.isSupporter ? (
            <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-200 border border-amber-500/35">
              ⭐ Supporter{profile.supporterTier ? ` · ${profile.supporterTier}` : ''}
            </span>
          ) : null}
          {preview ? (
            <span className="text-gray-500">
              {preview.distanceKm != null
                ? `${preview.distanceKm} km · à proximité`
                : preview.city
                  ? `${preview.city} · à proximité`
                  : 'À proximité'}
            </span>
          ) : null}
        </div>

        {/* Stats row */}
        {statsItems.length > 0 ? (
          <div className="mt-4 flex gap-6 sm:gap-10">
            {statsItems.map((item) => (
              <div key={item.label} className="text-left">
                <p className="text-base font-bold text-white tabular-nums">{item.value}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">{item.label}</p>
              </div>
            ))}
          </div>
        ) : null}

        {/* Bio */}
        {profile?.bio ? (
          <p className="mt-3 text-sm text-gray-300 leading-relaxed whitespace-pre-wrap break-words">
            {profile.bio}
          </p>
        ) : null}
      </div>

      <div className="px-4 mt-5 space-y-5 max-w-lg mx-auto w-full">
        {currentListening && (
          <ProfileCurrentListening
            listening={currentListening}
            {...(activeSalonId && onOpenSalon
              ? {
                  onClick: openActiveSalon,
                  clickAriaLabel: 'Rejoindre le salon',
                }
              : {})}
          />
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

        {/* Galerie photos — toutes les photos uploadées */}
        {viewablePhotos.length > 0 && (
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wide">
                Photos
              </h3>
              <span className="text-[11px] text-gray-500 font-medium tabular-nums">
                {viewablePhotos.length}
              </span>
            </div>
            <div
              className={
                isLiveHost
                  ? 'p-0.5 rounded-2xl bg-gradient-to-br from-red-500 via-rose-500 to-red-600 shadow-[0_0_16px_rgba(239,68,68,0.35)]'
                  : ''
              }
            >
              <ProfilePhotoGallery
                photos={photos}
                fallbackSeed={userId}
                variant="bare"
                onPhotoClick={openPhotoViewer}
              />
            </div>
            {isLiveHost && (
              <p className="text-xs text-red-400 font-bold">
                🔴 En live
                {liveViewers != null && (
                  <> · {formatCompactCount(liveViewers)} spectateurs</>
                )}
              </p>
            )}
          </section>
        )}

        <CompactTagChips
          interests={profile?.interests ?? []}
          genres={profile?.favoriteGenres ?? []}
          artists={profile?.favoriteArtists ?? []}
          align="start"
        />

        {heartHint()}

        {heartToast && (
          <p className="text-sm font-semibold text-pink-200 bg-pink-950/40 border border-pink-500/40 rounded-xl px-3 py-2.5">
            Cœur envoyé ! 💜
          </p>
        )}

        {salonGateToast && (
          <p className="text-sm font-semibold text-amber-200 bg-amber-950/40 border border-amber-500/40 rounded-xl px-3 py-2.5">
            {salonGateToast}
          </p>
        )}

        {/* Actions sociales */}
        {!isSelf && (onOpenDm || !isMatched) && (
          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            {!isSelf && onOpenDm && (
              isMutualFollow ? (
                <button
                  type="button"
                  onClick={() => onOpenDm(userId)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold border border-purple-500/50 bg-purple-600/80 hover:bg-purple-600 text-white transition"
                >
                  {t('profile.messageButton')}
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  title={t('profile.messageButtonDisabledTitle')}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold border border-[#2d2d3d] bg-[#1a1a26]/90 text-gray-500 cursor-not-allowed"
                >
                  {t('profile.messageButtonDisabled')}
                </button>
              )
            )}

            {!isSelf && !isMatched && (
              <button
                type="button"
                onClick={sendHeart}
                disabled={sending || heartSent || !heartAllowed}
                title={!heartAllowed && !heartSent ? (heartBlockReason ?? undefined) : undefined}
                className={`flex-1 py-2.5 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition ${
                  heartSent
                    ? 'bg-pink-900/40 border border-pink-500/40 text-pink-200'
                    : matchStatus?.theySentHeart
                      ? 'bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 shadow-lg shadow-pink-900/40 animate-pulse'
                      : 'bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 shadow-lg shadow-pink-900/30'
                } disabled:opacity-60`}
              >
                <span className="text-lg">{heartSent ? '💗' : '♥'}</span>
                {heartSent
                  ? 'Cœur envoyé'
                  : sending
                    ? 'Envoi...'
                    : matchStatus?.theySentHeart
                      ? 'Match !'
                      : 'Cœur'}
              </button>
            )}
          </div>
        )}

        {!isSelf && !isMatched && heartBlockMessages.length > 0 && !heartSent && (
          <div className="space-y-0.5 px-1 -mt-2">
            {heartBlockMessages.map((message) => (
              <p key={message} className="text-[10px] text-gray-500 leading-snug">
                {message}
              </p>
            ))}
          </div>
        )}

        {error && profile && <p className="text-xs text-red-400">{error}</p>}
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
