import { useCallback, useEffect, useState } from 'react';
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
import { canSendHeart, heartDisabledReason, isSingleForHeart, userMeetsHeartAge } from '../lib/canSendHeart';
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
  const [showFullBio, setShowFullBio] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const isSelf = me?.id === userId;
  const isMatched = Boolean(matchStatus?.matched || justMatched);
  const heartAllowed = canSendHeart(me, profile);
  const heartBlockReason = heartDisabledReason(me, profile);
  const profileIsSingle = isSingleForHeart(profile);
  const profileMeetsAge = userMeetsHeartAge(profile);
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
    return (
      <div className="w-full bg-[#0b0b0f]">
        {/* Skeleton banner */}
        <div className="h-32 sm:h-40 w-full bg-gradient-to-br from-purple-950/60 via-[#12121a] to-pink-950/40 animate-pulse" />
        <div className="px-4 -mt-14 relative z-10">
          <div className="flex justify-between items-end">
            <div className="w-20 h-20 rounded-full bg-[#1e1e2f] ring-4 ring-[#0b0b0f] animate-pulse" />
            <div className="mb-1 flex gap-2">
              <div className="w-20 h-8 rounded-full bg-[#1e1e2f] animate-pulse" />
              <div className="w-9 h-8 rounded-full bg-[#1e1e2f] animate-pulse" />
            </div>
          </div>
          <div className="mt-3 h-5 w-36 bg-[#1e1e2f] rounded-lg animate-pulse" />
          <div className="mt-2 h-3.5 w-24 bg-[#1e1e2f] rounded animate-pulse" />
          <div className="mt-4 flex gap-4">
            <div className="h-3.5 w-16 bg-[#1e1e2f] rounded animate-pulse" />
            <div className="h-3.5 w-16 bg-[#1e1e2f] rounded animate-pulse" />
            <div className="h-3.5 w-16 bg-[#1e1e2f] rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
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
      ]
    : [];


  const bioText = profile?.bio?.trim() ?? '';
  const BIO_LIMIT = 120;
  const bioIsTruncatable = bioText.length > BIO_LIMIT;

  const fadeStyle: React.CSSProperties = {
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(12px)',
    transition: 'opacity 0.35s ease, transform 0.35s ease',
  };

  const showHeartButton = !isSelf && !isMatched && profileIsSingle && profileMeetsAge;
  const showMessageButton = !isSelf && !!onOpenDm;

  return (
    <div className="w-full bg-[#0b0b0f] pb-10" style={fadeStyle}>

      {/* Match banner */}
      {(isMatched || justMatched) && (
        <div className="mx-4 mt-4 text-center p-4 rounded-2xl bg-gradient-to-br from-pink-900/50 to-purple-900/40 border border-pink-500/40">
          <p className="text-3xl mb-1">💞</p>
          <p className="text-lg font-bold text-white">Match musical !</p>
          <p className="text-sm text-pink-200 mt-1">
            Vous et {displayName} partagez les mêmes vibes
          </p>
        </div>
      )}

      {/* ── HERO BANNER ── */}
      <div className="relative">
        <PublicProfilePhotoHero
          photos={viewerPhotos}
          isLive={isLiveHost}
          onPhotoClick={viewerPhotos.length > 0 ? openPhotoViewer : undefined}
        />
      </div>

      {/* ── IDENTITY BLOCK ── */}
      <div className="px-4 relative z-10">

        {/* Avatar row: avatar left, action buttons right */}
        <div className="flex justify-between items-end -mt-14 sm:-mt-16">

          {/* Avatar with gradient ring */}
          {viewerPhotos.length > 0 ? (
            <button
              type="button"
              onClick={() => openPhotoViewer(0)}
              className="shrink-0 rounded-full p-[3px] bg-gradient-to-tr from-purple-600 via-pink-500 to-purple-400 shadow-[0_0_24px_rgba(168,85,247,0.5)] ring-[3px] ring-[#0b0b0f] cursor-pointer hover:opacity-90 transition focus:outline-none focus-visible:ring-purple-500"
              aria-label="Voir les photos du profil"
            >
              <div className="rounded-full bg-[#0b0b0f] p-0.5">
                <UserAvatarOnline
                  userId={userId}
                  username={displayName}
                  avatarUrl={avatarUrl}
                  size="hero"
                  isLive={isLiveHost}
                  liveViewersCount={liveViewers}
                />
              </div>
            </button>
          ) : (
            <div className="shrink-0 rounded-full p-[3px] bg-gradient-to-tr from-purple-600 via-pink-500 to-purple-400 shadow-[0_0_24px_rgba(168,85,247,0.5)] ring-[3px] ring-[#0b0b0f]">
              <div className="rounded-full bg-[#0b0b0f] p-0.5">
                <UserAvatarOnline
                  userId={userId}
                  username={displayName}
                  avatarUrl={avatarUrl}
                  size="hero"
                  isLive={isLiveHost}
                  liveViewersCount={liveViewers}
                />
              </div>
            </div>
          )}

          {/* Action buttons — shown only for other users */}
          {!isSelf && (
            <div className="flex items-center gap-2 mb-1">
              <FollowUserButton
                userId={userId}
                username={displayName}
                initialFollowing={profile?.isFollowing}
                variant="pill"
                onFollowingChange={(following) =>
                  setProfile((p) => (p ? { ...p, isFollowing: following } : p))
                }
              />
              {/* Message icon button */}
              {onOpenDm && (
                <button
                  type="button"
                  onClick={() => isMutualFollow ? onOpenDm(userId) : undefined}
                  disabled={!isMutualFollow}
                  title={isMutualFollow ? t('profile.messageButton') : t('profile.messageButtonDisabledTitle')}
                  className={`w-9 h-9 rounded-full border flex items-center justify-center transition ${
                    isMutualFollow
                      ? 'border-[#3d3d50] text-gray-300 hover:border-purple-500/60 hover:text-purple-300'
                      : 'border-[#2a2a38] text-gray-600 cursor-not-allowed'
                  }`}
                  aria-label={t('profile.messageButton')}
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Username + rating */}
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <UsernameDisplay
            as="h2"
            username={displayName}
            usernameColor={displayColor}
            usernameWaveFrom={displayWaveFrom}
            usernameWaveTo={displayWaveTo}
            className="text-xl sm:text-2xl font-extrabold leading-tight"
          />
          {profile?.isSupporter && (
            <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300 border border-amber-500/30">
              ⭐{profile.supporterTier ? ` ${profile.supporterTier}` : ''}
            </span>
          )}
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

        {/* Meta chips: location, age, relationship, proximity */}
        <div className="mt-2.5 flex flex-wrap gap-x-2 gap-y-1.5">
          {profile?.city?.trim() ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-gray-400 bg-[#1a1a26] border border-[#2d2d3d] rounded-full px-2.5 py-1">
              📍 {profile.city.trim()}
            </span>
          ) : null}
          {preview ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-purple-300/80 bg-purple-900/20 border border-purple-500/25 rounded-full px-2.5 py-1">
              {preview.distanceKm != null
                ? `📡 ${preview.distanceKm} km · proche`
                : '📡 À proximité'}
            </span>
          ) : null}
          {showFullBirthDate ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-gray-400 bg-[#1a1a26] border border-[#2d2d3d] rounded-full px-2.5 py-1">
              🎂 {formatBirthDate(birthDateTrimmed, i18n.language) ?? birthDateTrimmed}
            </span>
          ) : resolvedAge != null ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-gray-400 bg-[#1a1a26] border border-[#2d2d3d] rounded-full px-2.5 py-1">
              🎂 {resolvedAge} ans
            </span>
          ) : null}
          {relationshipStatus ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-pink-300/90 bg-pink-900/15 border border-pink-500/25 rounded-full px-2.5 py-1">
              {getRelationshipEmoji(relationshipStatus)}{' '}
              {getRelationshipDisplayLabel(
                relationshipStatus,
                profile?.relationshipStatusCustom,
                relationshipLabels
              )}
            </span>
          ) : null}
        </div>
      </div>

      {/* ── STATS ROW ── */}
      {statsItems.length > 0 && (
        <div className="mt-3 mx-4 flex rounded-xl bg-[#12121a] border border-[#1e1e2f] overflow-hidden">
          {statsItems.map((item, i) => (
            <div key={item.label} className="flex-1 relative">
              {i > 0 && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-px h-6 bg-[#1e1e2f]" />
              )}
              <button
                type="button"
                className="w-full py-2 flex flex-col items-center gap-0.5 active:bg-[#1e1e2f]/50 transition"
              >
                <span className="text-base font-extrabold text-white tabular-nums leading-none">
                  {item.value}
                </span>
                <span className="text-[9px] font-semibold text-gray-500 uppercase tracking-widest mt-0.5">
                  {item.label}
                </span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── BIO ── */}
      {bioText ? (
        <div className="px-4 mt-4">
          <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap break-words">
            {bioIsTruncatable && !showFullBio
              ? bioText.slice(0, BIO_LIMIT) + '…'
              : bioText}
          </p>
          {bioIsTruncatable && (
            <button
              type="button"
              onClick={() => setShowFullBio((v) => !v)}
              className="mt-1 text-xs font-semibold text-purple-400 hover:text-purple-300 transition"
            >
              {showFullBio ? 'voir moins' : 'voir plus'}
            </button>
          )}
        </div>
      ) : null}

      {/* ── CONTENT SECTION ── */}
      <div className="px-4 mt-5 space-y-4 max-w-lg mx-auto w-full">

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
            className="w-full py-3.5 rounded-2xl font-bold text-white flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 shadow-lg shadow-red-900/40 transition active:scale-[0.99]"
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

        {/* Photo gallery */}
        {viewablePhotos.length > 0 && (
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-semibold text-purple-400/70 uppercase tracking-widest">
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

        {/* ── PRIMARY SOCIAL ACTIONS ── */}
        {((showMessageButton && isMutualFollow) || showHeartButton) && (
          <div className="flex gap-2.5 pt-1">
            {showMessageButton && isMutualFollow && (
              <button
                type="button"
                onClick={() => onOpenDm!(userId)}
                className="flex-1 py-3 rounded-2xl text-sm font-bold border border-purple-500/40 bg-purple-600/15 hover:bg-purple-600/25 text-purple-200 transition flex items-center justify-center gap-2"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                {t('profile.messageButton')}
              </button>
            )}

            {showHeartButton && (
              <button
                type="button"
                onClick={sendHeart}
                disabled={sending || heartSent || !heartAllowed}
                title={!heartAllowed && !heartSent ? (heartBlockReason ?? undefined) : undefined}
                className={`flex-1 py-3 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition ${
                  heartSent
                    ? 'bg-pink-900/40 border border-pink-500/40 text-pink-200'
                    : matchStatus?.theySentHeart
                      ? 'bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 shadow-lg shadow-pink-900/40 animate-pulse'
                      : 'bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 shadow-lg shadow-pink-900/30'
                } disabled:opacity-60 active:scale-[0.98]`}
              >
                <span className="text-lg">{heartSent ? '💗' : '♥'}</span>
                <span className="text-sm font-bold">
                  {heartSent
                    ? 'Cœur envoyé'
                    : sending
                      ? 'Envoi...'
                      : matchStatus?.theySentHeart
                        ? 'Match !'
                        : 'Cœur'}
                </span>
              </button>
            )}
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
