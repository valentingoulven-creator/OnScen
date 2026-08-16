import { useEffect, useState } from 'react';
import { parseProfileTabFromLocation } from '../lib/profileDeepLink';
import { defaultHideBirthDateOnProfile } from '../lib/profileAge';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { UserProfileView } from '../components/UserProfileView';
import { UserReelsSection } from '../components/UserReelsSection';
import { UserLivesSection } from '../components/UserLivesSection';
import { UserCompositionsSection } from '../components/UserCompositionsSection';
import { UserEventsSection } from '../components/UserEventsSection';
import { UserPostsSection } from '../components/UserPostsSection';
import { ProfileVisitorActionsMenu } from '../components/ProfileVisitorActionsMenu';
import { ProfileHeaderSection } from '../components/ProfileHeaderSection';
import { ProfileStatsRow } from '../components/ProfileStatsRow';
import { parseProfileTab, ProfileTabBar, type ProfileTab } from '../components/ProfileTabBar';
import { ProfileCurrentListening } from '../components/ProfileCurrentListening';
import { ProfilePhotoViewer } from '../components/ProfilePhotoViewer';
import { HostRatingBlock } from '../components/HostRatingBlock';
import { FollowUserButton } from '../components/FollowUserButton';
import { FollowProfileNotificationsButton } from '../components/FollowProfileNotificationsButton';
import { ensureYoutubeLinkedToJoinSalon } from '../lib/platformConnect';
import { resolveProfileLiveId } from '../lib/profileLive';
import { useUserProfile } from '../hooks/useUserProfile';
import { isProfileTabVisible, useProfileTabVisibility } from '../hooks/useProfileTabVisibility';
import type { FeedPost, NearbyPerson } from '../types';

interface UserProfilePageProps {
  userId: string;
  preview?: NearbyPerson;
  onBack: () => void;
  onOpenReel?: (reelId: string) => void;
  onSelectSalon?: (salonId: string, salonTitle?: string, isHost?: boolean) => void;
  onOpenLive?: (liveId: string) => void;
  /** Ouvre l'enregistreur reel sur le profil personnel (propriétaire). */
  onRecordReel?: () => void;
  /** Profil en panneau sur la carte : bande carte visible en haut (~10 %), clic fond → onBack. */
  mapOverlay?: boolean;
  /** Ouvre la conversation DM avec cet utilisateur. */
  onOpenDm?: (userId: string) => void;
  /** Ouvre le détail d'une publication événement. */
  onOpenFeedPost?: (post: FeedPost) => void;
}

function initialProfileTab(): ProfileTab {
  return parseProfileTab(parseProfileTabFromLocation());
}

export function UserProfilePage({
  userId,
  preview,
  onBack,
  onOpenReel,
  onSelectSalon,
  onOpenLive,
  onRecordReel,
  mapOverlay = false,
  onOpenDm,
  onOpenFeedPost,
}: UserProfilePageProps) {
  const { user: me, token } = useAuth();
  const { t } = useTranslation();
  const [profileTab, setProfileTab] = useState<ProfileTab>(initialProfileTab);
  const [compositionsRefreshKey, setCompositionsRefreshKey] = useState(0);
  const [canViewPrivateReels, setCanViewPrivateReels] = useState(me?.id === userId);
  const [photoViewerIndex, setPhotoViewerIndex] = useState<number | null>(null);

  const {
    profile,
    setProfile,
    matchStatus,
    loading,
    sending,
    heartSent,
    justMatched,
    heartToast,
    error,
    isSelf,
    isMatched,
    heartAllowed,
    heartBlockReason,
    profileIsSingle,
    profileMeetsAge,
    avatarUrl,
    displayName,
    sendHeart,
  } = useUserProfile(userId, preview);

  const tabVisibility = useProfileTabVisibility(userId, {
    isSelf,
    token,
    canViewPrivateReels,
  });

  const reelsTabLabel = isSelf ? t('profile.tabReels') : t('profile.tabReelsOther');
  const livesTabLabel = isSelf ? t('profile.tabLives') : t('profile.tabLivesOther');

  useEffect(() => {
    setProfileTab(initialProfileTab());
  }, [userId]);

  useEffect(() => {
    if (isSelf) {
      setCanViewPrivateReels(true);
      return;
    }
    if (!token) {
      setCanViewPrivateReels(false);
      return;
    }
    let cancelled = false;
    api
      .getUserProfile(token, userId)
      .then((res) => {
        if (cancelled) return;
        setCanViewPrivateReels(Boolean(res.user.isFollowing && res.user.isFollowingMe));
      })
      .catch(() => {
        if (!cancelled) setCanViewPrivateReels(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, userId, isSelf, profileTab]);

  useEffect(() => {
    if (!tabVisibility.ready && !isSelf) return;
    if (isProfileTabVisible(profileTab, isSelf, tabVisibility)) return;
    setProfileTab('profil');
  }, [profileTab, isSelf, tabVisibility]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);

  const mainPhotoViewer = avatarUrl?.trim() ? [avatarUrl.trim()] : [];

  const openPhotoViewer = () => {
    if (mainPhotoViewer.length === 0) return;
    setPhotoViewerIndex(0);
  };

  const showHostRating =
    profile?.listeningRole === 'host' ||
    profile?.listeningRole === 'les_deux' ||
    (profile?.stats?.salonsHosted ?? 0) > 0;

  const currentListening = profile?.currentListening ?? preview?.currentListening;
  const activeSalonId = profile?.salonId ?? preview?.salonId;
  const activeSalonTitle = profile?.salonTitle ?? preview?.salonTitle;
  const profileIsLiveHost = Boolean(profile?.isLive ?? preview?.isLive);
  const profileLiveId = resolveProfileLiveId(profile, preview);

  const openActiveSalon = () => {
    if (!activeSalonId || !onSelectSalon) return;
    const platform = currentListening?.platform ?? 'youtube';
    if (!ensureYoutubeLinkedToJoinSalon(me?.connectedPlatforms, isSelf, platform)) {
      return;
    }
    onSelectSalon(activeSalonId, activeSalonTitle, isSelf);
  };

  const liveListening =
    profile?.liveListening ?? (profileIsLiveHost ? currentListening : undefined);
  const salonListening =
    profile?.salonListening ?? (!profileIsLiveHost && activeSalonId ? currentListening : undefined);

  const showLiveChip = Boolean(profileIsLiveHost && profileLiveId && onOpenLive && liveListening);
  const showSalonChip = Boolean(activeSalonId && onSelectSalon && !profileIsLiveHost);
  const showSessionChips = showLiveChip || showSalonChip;

  const shellClass = mapOverlay
    ? 'absolute inset-x-0 bottom-0 top-[10%] flex flex-col min-h-0 max-h-none overflow-hidden bg-[#0b0b0f] rounded-t-2xl border-t border-[#1e1e2f] shadow-[0_-8px_40px_rgba(0,0,0,0.55)] pointer-events-auto'
    : 'flex flex-col h-full min-h-0 bg-[#0b0b0f]';

  const profileContent = (
    <div className={shellClass}>
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain pb-[calc(var(--tab-nav-total-h)+2rem)]">
        <div className="shrink-0 border-b border-[#1e1e2f]/70 bg-[#0b0b0f]">
          <div className="relative max-w-lg mx-auto w-full overflow-visible">
            <div className="absolute top-3 left-3 z-30">
              <button
                type="button"
                onClick={onBack}
                className="w-11 h-11 flex items-center justify-center rounded-full bg-black/45 backdrop-blur-md border border-white/15 text-white hover:bg-black/65 transition"
                aria-label={t('common.back')}
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            </div>

            {loading && !profile ? (
              <div className="relative shrink-0 overflow-visible">
                <div className="relative h-24 sm:h-28 overflow-hidden bg-gradient-to-br from-purple-950/60 via-[#12121a] to-pink-950/40 animate-pulse" />
                <div className="px-4 pb-4 -mt-[3.25rem] sm:-mt-14 flex flex-col items-center">
                  <div className="w-20 h-20 rounded-full bg-[#1e1e2f] ring-[3px] ring-[#0b0b0f] animate-pulse" />
                  <div className="mt-3 h-6 w-40 bg-[#1e1e2f] rounded-lg animate-pulse" />
                  <div className="mt-3 h-14 w-full max-w-sm bg-[#1e1e2f] rounded-2xl animate-pulse" />
                </div>
              </div>
            ) : error && !profile ? (
              <p className="p-8 text-center text-red-400 text-sm">{error}</p>
            ) : (
              <>
                <ProfileHeaderSection
                  variant="compact"
                  userId={userId}
                  username={displayName}
                  usernameColor={profile?.usernameColor ?? preview?.usernameColor}
                  usernameWaveFrom={profile?.usernameWaveFrom ?? preview?.usernameWaveFrom}
                  usernameWaveTo={profile?.usernameWaveTo ?? preview?.usernameWaveTo}
                  avatarUrl={avatarUrl}
                  profileType={profile?.profileType}
                  city={profile?.city ?? preview?.city}
                  birthDate={profile?.birthDate}
                  age={profile?.age}
                  hideBirthDateOnProfile={
                    profile?.hideBirthDateOnProfile ?? defaultHideBirthDateOnProfile(profile)
                  }
                  relationshipStatus={
                    profile?.relationshipStatus === 'autre' ? undefined : profile?.relationshipStatus
                  }
                  isLive={profile?.isLive ?? preview?.isLive}
                  liveViewersCount={profile?.liveViewersCount ?? preview?.liveViewersCount}
                  isSupporter={profile?.isSupporter}
                  supporterTier={profile?.supporterTier}
                  onAvatarClick={mainPhotoViewer.length > 0 ? openPhotoViewer : undefined}
                  topRightAction={
                    !isSelf ? (
                      <div className="flex items-center justify-end gap-2 flex-wrap max-w-[calc(100vw-3.5rem)] sm:max-w-none">
                        <FollowUserButton
                          userId={userId}
                          username={displayName}
                          initialFollowing={profile?.isFollowing}
                          variant="pill"
                          className="shrink-0 [&>button]:min-h-11 [&>button]:flex [&>button]:items-center"
                          onFollowingChange={(following) =>
                            setProfile((p) =>
                              p
                                ? {
                                    ...p,
                                    isFollowing: following,
                                    followNotificationsEnabled: following
                                      ? (p.followNotificationsEnabled ?? true)
                                      : undefined,
                                  }
                                : p
                            )
                          }
                        />
                        {profile?.isFollowing ? (
                          <FollowProfileNotificationsButton
                            userId={userId}
                            isFollowing={!!profile.isFollowing}
                            initialEnabled={profile.followNotificationsEnabled !== false}
                            onEnabledChange={(enabled) =>
                              setProfile((p) =>
                                p ? { ...p, followNotificationsEnabled: enabled } : p
                              )
                            }
                          />
                        ) : null}
                        {onOpenDm && (
                          <button
                            type="button"
                            onClick={() => onOpenDm(userId)}
                            title={t('profile.messageButton')}
                            className="w-11 h-11 rounded-full bg-black/45 border border-white/15 backdrop-blur-md flex items-center justify-center text-gray-200 hover:bg-black/65 hover:text-white transition-colors shrink-0"
                            aria-label={t('profile.messageButton')}
                          >
                            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                          </button>
                        )}
                        <ProfileVisitorActionsMenu
                          userId={userId}
                          username={displayName}
                          reportContext={{
                            targetUserId: userId,
                            targetUsername: displayName,
                            roomType: 'profile',
                          }}
                        />
                      </div>
                    ) : undefined
                  }
                  statsRow={
                    profile ? (
                      <ProfileStatsRow
                        followers={profile.favoritesCount}
                        following={profile.followingCount}
                        thirdValue={profile.stats?.salonsHosted ?? 0}
                      />
                    ) : undefined
                  }
                  bio={
                    profile?.bio?.trim() ? (
                      <p className="whitespace-pre-wrap break-words">{profile.bio.trim()}</p>
                    ) : undefined
                  }
                  hostRatingSlot={
                    showHostRating && profile ? (
                      <HostRatingBlock
                        hostId={userId}
                        hostName={displayName}
                        averageOnly
                        initialRating={profile.hostRating}
                      />
                    ) : undefined
                  }
                  extraMeta={
                    preview?.distanceKm != null && profile?.city?.trim() ? (
                      <p className="mt-2 text-[11px] text-purple-300/80">
                        📡 {preview.distanceKm} km · proche
                      </p>
                    ) : preview && !profile?.city?.trim() ? (
                      <p className="mt-2 text-[11px] text-purple-300/80">
                        {preview.distanceKm != null
                          ? `📡 ${preview.distanceKm} km · proche`
                          : '📡 À proximité'}
                      </p>
                    ) : undefined
                  }
                />

                {showSessionChips ? (
                  <div className="px-4 pb-2 max-w-lg mx-auto w-full">
                    {showLiveChip && liveListening ? (
                      <ProfileCurrentListening
                        variant="live"
                        listening={liveListening}
                        viewersCount={profile?.liveViewersCount ?? preview?.liveViewersCount}
                        actionLabel={t('profile.sessionJoin', { defaultValue: 'Rejoindre' })}
                        onClick={() => onOpenLive!(profileLiveId!)}
                        clickAriaLabel={t('profile.joinLiveListening', { defaultValue: 'Rejoindre le live' })}
                        statusActiveLabel={t('profile.liveListeningStatus', { defaultValue: 'En direct' })}
                        statusPausedLabel={t('profile.liveListeningStatus', { defaultValue: 'En direct' })}
                      />
                    ) : showSalonChip ? (
                      salonListening ? (
                        <ProfileCurrentListening
                          variant="salon"
                          listening={salonListening}
                          actionLabel={t('profile.sessionJoin', { defaultValue: 'Rejoindre' })}
                          onClick={openActiveSalon}
                          clickAriaLabel={t('profile.joinSalonListening', { defaultValue: 'Rejoindre le salon' })}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={openActiveSalon}
                          className="w-full min-h-[44px] rounded-xl border border-purple-500/30 bg-purple-950/30 px-4 py-3 text-left hover:bg-purple-950/45 transition-colors"
                        >
                          <p className="text-[10px] font-bold uppercase tracking-wider text-purple-400">
                            {t('profile.activeSalonLabel', { defaultValue: 'Salon actif' })}
                          </p>
                          <p className="text-sm font-semibold text-white truncate">
                            {activeSalonTitle || t('profile.defaultSalonTitle', { defaultValue: 'Salon de musique' })}
                          </p>
                          <p className="text-xs text-purple-200/80 mt-1">
                            {t('profile.tapToJoinSalon', { defaultValue: 'Appuyer pour rejoindre' })}
                          </p>
                        </button>
                      )
                    ) : null}
                  </div>
                ) : null}

                <ProfileTabBar
                  active={profileTab}
                  onChange={(id) => {
                    setProfileTab(id);
                    if (id === 'compositions') setCompositionsRefreshKey((k) => k + 1);
                  }}
                  showReels={isSelf ? !!onOpenReel : tabVisibility.showReels && !!onOpenReel}
                  showCompositions={isSelf || tabVisibility.showCompositions}
                  showProgrammation={isSelf || tabVisibility.showProgrammation}
                  showLives={isSelf ? !!onOpenLive : tabVisibility.showLives && !!onOpenLive}
                  reelsLabel={reelsTabLabel}
                  livesLabel={livesTabLabel}
                />
              </>
            )}
          </div>
        </div>

        {!loading && (profile || preview) && (
          <div className="max-w-lg mx-auto w-full px-4 space-y-5 pt-4">
            {profileTab === 'profil' ? (
              <>
                <UserProfileView
                  profile={profile}
                  preview={preview}
                  displayName={displayName}
                  isSelf={isSelf}
                  isMatched={isMatched}
                  justMatched={justMatched}
                  matchStatus={matchStatus}
                  heartSent={heartSent}
                  heartToast={heartToast}
                  heartAllowed={heartAllowed}
                  heartBlockReason={heartBlockReason}
                  profileIsSingle={profileIsSingle}
                  profileMeetsAge={profileMeetsAge}
                  sending={sending}
                  error={error}
                  onOpenLive={onOpenLive}
                  onOpenSalon={onSelectSalon}
                  onSendHeart={() => void sendHeart()}
                  meConnectedPlatforms={me?.connectedPlatforms}
                />
                <UserPostsSection userId={userId} hideSectionTitle />
              </>
            ) : profileTab === 'reels' ? (
              onOpenReel && (
                <UserReelsSection
                  userId={userId}
                  isOwner={isSelf}
                  canViewPrivateReels={canViewPrivateReels}
                  layout="grid"
                  hideSectionTitle
                  defaultOwnerTab="published"
                  defaultArtist={isSelf ? (me?.username ?? '') : displayName}
                  onOpenReel={onOpenReel}
                  onRecordReel={isSelf ? onRecordReel : undefined}
                />
              )
            ) : profileTab === 'compositions' ? (
              <UserCompositionsSection
                userId={userId}
                readOnly={!isSelf}
                defaultArtist={isSelf ? (me?.username ?? '') : displayName}
                refreshKey={compositionsRefreshKey}
              />
            ) : profileTab === 'lives' ? (
              <UserLivesSection
                userId={userId}
                isOwner={isSelf}
                hideSectionTitle
                onOpenLive={onOpenLive}
              />
            ) : (
              <UserEventsSection
                userId={userId}
                onOpenPost={onOpenFeedPost}
                canManageGuestEvents={isSelf}
              />
            )}
          </div>
        )}
      </div>

      {photoViewerIndex !== null && mainPhotoViewer.length > 0 && (
        <ProfilePhotoViewer
          photos={mainPhotoViewer}
          initialIndex={photoViewerIndex}
          onClose={() => setPhotoViewerIndex(null)}
        />
      )}
    </div>
  );

  if (mapOverlay) {
    return (
      <div className="absolute inset-0 z-40 pointer-events-none">
        {profileContent}
      </div>
    );
  }

  return profileContent;
}
