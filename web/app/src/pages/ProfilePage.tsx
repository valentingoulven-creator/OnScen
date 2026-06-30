import { useCallback, useEffect, useState } from 'react';
import { REELS_UPDATED_EVENT } from '../lib/reelsRefresh';
import { useTranslation } from 'react-i18next';
import {
  MAX_PROFILE_PAYLOAD_CHARS,
  assertPreparedProfilePhotos,
  countPersistableProfilePhotos,
  getUserProfilePhotos,
  prepareProfilePhotosForSave,
  resolveAvatarUrl,
  shouldIncludeProfilePhotosInSave,
} from '../lib/profilePhotos';
import {
  defaultHideBirthDateOnProfile,
  validateBirthDate,
} from '../lib/profileAge';
import { BirthDateInput } from '../components/BirthDateInput';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { ArtistAutocomplete } from '../components/ArtistAutocomplete';
import { ListAutocomplete } from '../components/ListAutocomplete';
import { searchGenres } from '../lib/genreSearch';
import { searchInterests } from '../lib/interestSearch';
import { INTEREST_CATEGORIES } from '../lib/popularInterests';
import { CityAutocomplete } from '../components/CityAutocomplete';
import { HostRatingBlock } from '../components/HostRatingBlock';
import { ProfilePhotoGallery } from '../components/ProfilePhotoGallery';
import {
  getViewableProfilePhotos,
  ProfilePhotoViewer,
} from '../components/ProfilePhotoViewer';
import { SettingsPage, SettingsGearButton } from './SettingsPage';
import { ContactSoundyPage } from './ContactSoundyPage';
import { PlatformSubscriptionPage } from './PlatformSubscriptionPage';
import { SupportMeloSongTeaser } from '../components/SupportMeloSongSection';
import { DonationSheet } from '../components/DonationSheet';
import { ProfileReelRecorder } from '../components/ProfileReelRecorder';
import { UserReelsSection } from '../components/UserReelsSection';
import { UserCompositionsSection } from '../components/UserCompositionsSection';
import { UserEventsSection } from '../components/UserEventsSection';
import { UserLivesSection } from '../components/UserLivesSection';
import { CreatorDashboardCard } from '../components/CreatorDashboardCard';
import { PlatformConnectCard } from '../components/PlatformConnectCard';
import { CreatorStripeConnectCard } from '../components/CreatorStripeConnectCard';
import { UsernameColorPicker } from '../components/UsernameColorPicker';
import {
  USERNAME_COLOR_WAVE,
  isWaveUsernameColor,
  resolveUsernameWaveColors,
  usernameDisplayStyle,
} from '../lib/usernameColor';
import { ProfileCurrentListening } from '../components/ProfileCurrentListening';
import { MyFavoritesSheet } from '../components/MyFavoritesSheet';
import { formatCompactCount } from '../lib/formatCount';
import { CompactTagChips } from '../components/CompactTagChips';
import { ProfileHeaderSection } from '../components/ProfileHeaderSection';
import { ConfirmModal } from '../components/ConfirmModal';
import { PROFILE_TYPE_OPTIONS } from '../lib/profileTypes';
import type { FeedPost, ProfileType, RelationshipStatus, User } from '../types';

const HIDE_AGE_CHECKBOX_ID = 'profile-hide-age';

const PROFILE_ACCOUNT_ROW_CLASS =
  'relative w-full min-h-[44px] px-4 py-3 text-left text-gray-200 font-semibold text-sm hover:bg-[#1a1a26]/80 transition flex items-center justify-between gap-2';

function profileToForm(user: User | null) {
  const profilePhotos = getUserProfilePhotos(user);
  return {
    username: user?.username ?? '',
    usernameColor: user?.usernameColor ?? '',
    usernameWaveFrom: user?.usernameWaveFrom ?? '',
    usernameWaveTo: user?.usernameWaveTo ?? '',
    bio: user?.bio ?? '',
    city: user?.city ?? '',
    avatarUrl: profilePhotos[0] ?? '',
    profilePhotos,
    profileType: user?.profileType ?? '',
    relationshipStatus:
      user?.relationshipStatus === 'autre' ? '' : (user?.relationshipStatus ?? ''),
    birthDate: user?.birthDate ?? '',
    hideBirthDateOnProfile:
      user?.hideBirthDateOnProfile ?? defaultHideBirthDateOnProfile(user),
    interests: [...(user?.interests ?? [])],
    favoriteGenres: [...(user?.favoriteGenres ?? [])],
    favoriteArtists: [...(user?.favoriteArtists ?? [])],
    connectedPlatforms: [...(user?.connectedPlatforms ?? [])],
    newInterest: '',
    newGenre: '',
    newArtist: '',
  };
}

type ProfileTab = 'profil' | 'reels' | 'compositions' | 'programmation' | 'lives';

function parseProfileTabFromSearch(tab: string | null): ProfileTab {
  if (tab === 'events') return 'programmation';
  if (
    tab === 'compositions' ||
    tab === 'reels' ||
    tab === 'lives' ||
    tab === 'profil' ||
    tab === 'programmation'
  ) {
    return tab;
  }
  return 'profil';
}

interface ProfilePageProps {
  onBack?: () => void;
  onOpenReel?: (reelId: string) => void;
  onOpenLive?: (liveId: string) => void;
  onOpenProfile?: (userId: string) => void;
  onOpenSalon?: (salonId: string, salonTitle?: string, isHost?: boolean) => void;
  /** Ouvre le détail d'une publication événement (onglet Programmation). */
  onOpenFeedPost?: (post: FeedPost) => void;
  /** À l’ouverture : Mes reels + enregistreur (ex. depuis profil carte). */
  openRecorderOnMount?: boolean;
  onRecorderMountHandled?: () => void;
  /** À l’ouverture : page Contacter Soundy (ex. notification support_reply). */
  openContactOnMount?: boolean;
  onContactMountHandled?: () => void;
  /** Message support à mettre en évidence (depuis notification support_reply). */
  highlightSupportMessageId?: string;
}

export function ProfilePage({
  onBack,
  onOpenReel,
  onOpenLive,
  onOpenProfile,
  onOpenSalon,
  onOpenFeedPost,
  openRecorderOnMount = false,
  onRecorderMountHandled,
  openContactOnMount = false,
  onContactMountHandled,
  highlightSupportMessageId,
}: ProfilePageProps) {
  const { user, token, logout, setUserFromProfile, refreshUser } = useAuth();
  const { t } = useTranslation();
  const [profileTab, setProfileTab] = useState<ProfileTab>(() =>
    parseProfileTabFromSearch(new URLSearchParams(window.location.search).get('tab'))
  );
  const [showReelRecorder, setShowReelRecorder] = useState(false);
  const [reelsRefreshKey, setReelsRefreshKey] = useState(0);
  const [compositionsRefreshKey, setCompositionsRefreshKey] = useState(0);
  const [editing, setEditing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);
  const [showContactSoundy, setShowContactSoundy] = useState(false);
  const [showFavoritesSheet, setShowFavoritesSheet] = useState(false);
  const [showDonationSheet, setShowDonationSheet] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [myFavoritesCount, setMyFavoritesCount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [photoGalleryBusy, setPhotoGalleryBusy] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [streamingExpanded, setStreamingExpanded] = useState(false);
  const [photoViewerIndex, setPhotoViewerIndex] = useState<number | null>(null);

  const [form, setForm] = useState(() => profileToForm(user));

  const relationshipLabels = {
    celibataire: t('profile.relationshipSingle'),
    en_couple: t('profile.relationshipCouple'),
  } as const;

  useEffect(() => {
    if (user && !editing) setForm(profileToForm(user));
  }, [user, editing]);

  useEffect(() => {
    if (token) void refreshUser();
  }, [token, refreshUser]);

  useEffect(() => {
    if (!token || editing) return;
    let cancelled = false;
    api
      .getMyFavorites(token)
      .then((r) => {
        if (!cancelled) setMyFavoritesCount(r.favorites.length);
      })
      .catch(() => {
        if (!cancelled) setMyFavoritesCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, [token, editing]);

  useEffect(() => {
    const onReelsUpdated = () => setReelsRefreshKey((k) => k + 1);
    window.addEventListener(REELS_UPDATED_EVENT, onReelsUpdated);
    return () => window.removeEventListener(REELS_UPDATED_EVENT, onReelsUpdated);
  }, []);

  useEffect(() => {
    if (!openRecorderOnMount) return;
    setProfileTab('reels');
    setShowReelRecorder(true);
    onRecorderMountHandled?.();
  }, [openRecorderOnMount, onRecorderMountHandled]);

  useEffect(() => {
    if (!openContactOnMount) return;
    setShowContactSoundy(true);
    onContactMountHandled?.();
  }, [openContactOnMount, onContactMountHandled]);

  const startEditing = useCallback(async () => {
    if (!user || !token) return;
    setSavedMsg(null);
    setSaveError(null);
    try {
      const { user: fresh } = await api.me(token);
      setUserFromProfile(fresh);
      setForm(profileToForm(fresh));
    } catch {
      setForm(profileToForm(user));
    }
    setEditing(true);
  }, [user, token, setUserFromProfile]);

  const saveProfile = useCallback(async () => {
    if (!user || !token) return;
    if (photoGalleryBusy) {
      setSaveError('Terminez la modification de la photo avant d\'enregistrer.');
      return;
    }
    const name = form.username.trim();
    if (name.length < 2) {
      setSaveError('Le pseudo doit faire au moins 2 caractères');
      return;
    }
    const birthDateTrim = form.birthDate.trim();
    if (birthDateTrim) {
      const birthError = validateBirthDate(birthDateTrim);
      if (birthError) {
        setSaveError(t(`profile.${birthError}`));
        return;
      }
    }
    setSaving(true);
    setSavedMsg(null);
    setSaveError(null);
    try {
      const currentPhotos = getUserProfilePhotos(user);
      const includePhotos = shouldIncludeProfilePhotosInSave(currentPhotos, form.profilePhotos);
      const intendedPhotoCount = countPersistableProfilePhotos(form.profilePhotos);

      const waveFrom = form.usernameWaveFrom.trim();
      const waveTo = form.usernameWaveTo.trim();
      const colorTrim = form.usernameColor.trim();
      const usernameColor =
        isWaveUsernameColor(colorTrim) || waveFrom || waveTo
          ? USERNAME_COLOR_WAVE
          : colorTrim || null;

      const body: Record<string, unknown> = {
        username: name,
        usernameColor,
        usernameWaveFrom: waveFrom || null,
        usernameWaveTo: waveTo || null,
        bio: form.bio,
        city: form.city,
        profileType: form.profileType || null,
        relationshipStatus: form.relationshipStatus || null,
        birthDate: birthDateTrim || null,
        hideBirthDateOnProfile: birthDateTrim ? form.hideBirthDateOnProfile : true,
        interests: form.interests,
        favoriteGenres: form.favoriteGenres,
        favoriteArtists: form.favoriteArtists,
      };

      if (includePhotos) {
        const preparedPhotos = await prepareProfilePhotosForSave(form.profilePhotos);
        assertPreparedProfilePhotos(form.profilePhotos, preparedPhotos);
        body.profilePhotos = preparedPhotos;
      }

      const payload = JSON.stringify(body);
      if (payload.length > MAX_PROFILE_PAYLOAD_CHARS) {
        throw new Error(
          'Profil trop volumineux (photos). Retirez une photo ou utilisez des images plus légères.'
        );
      }

      const { user: updated } = await api.updateProfile(token, body);
      if (includePhotos && intendedPhotoCount > 0) {
        const savedPhotoCount = countPersistableProfilePhotos(getUserProfilePhotos(updated));
        if (savedPhotoCount < intendedPhotoCount) {
          throw new Error(
            'Les photos n\'ont pas été enregistrées correctement. Réessayez ou réduisez la taille des images.'
          );
        }
      }
      setUserFromProfile(updated);
      setForm(profileToForm(updated));
      setEditing(false);
      setSavedMsg('Profil enregistré');
      setTimeout(() => setSavedMsg(null), 3000);
      await refreshUser();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Impossible d\'enregistrer le profil';
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  }, [user, token, form, photoGalleryBusy, setUserFromProfile, refreshUser, t]);

  if (!user || !token) return null;

  if (showContactSoundy) {
    return (
      <ContactSoundyPage
        onBack={() => setShowContactSoundy(false)}
        highlightMessageId={highlightSupportMessageId}
      />
    );
  }

  if (showSubscription) {
    return <PlatformSubscriptionPage onBack={() => setShowSubscription(false)} />;
  }

  if (showSettings) {
    return <SettingsPage onBack={() => setShowSettings(false)} />;
  }

  const memberDate = user.memberSince
    ? new Date(user.memberSince).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    : '—';

  const showHostRating =
    user.listeningRole === 'host' ||
    user.listeningRole === 'les_deux' ||
    (user.stats?.salonsHosted ?? 0) > 0;

  const displayPhotos = editing ? form.profilePhotos : getUserProfilePhotos(user);
  const viewablePhotos = !editing ? getViewableProfilePhotos(displayPhotos) : [];
  const headerAvatarUrl = editing
    ? displayPhotos.find((url) => url.trim())
    : resolveAvatarUrl(user);
  const viewerPhotos = !editing
    ? viewablePhotos.length > 0
      ? viewablePhotos
      : headerAvatarUrl
        ? [headerAvatarUrl]
        : []
    : [];

  const openPhotoViewer = (index: number) => {
    if (viewerPhotos.length === 0) return;
    setPhotoViewerIndex(Math.max(0, Math.min(index, viewerPhotos.length - 1)));
  };

  const addTag = (field: 'interests' | 'favoriteGenres' | 'favoriteArtists', value: string) => {
    const v = value.trim();
    if (!v || form[field].includes(v)) return;
    setForm((f) => ({ ...f, [field]: [...f[field], v] }));
  };

  const removeTag = (field: 'interests' | 'favoriteGenres' | 'favoriteArtists', tag: string) => {
    setForm((f) => ({ ...f, [field]: f[field].filter((t) => t !== tag) }));
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#0b0b0f]">
      <div className="shrink-0 sticky top-0 z-20 bg-[#0b0b0f]/95 backdrop-blur-md border-b border-[#1e1e2f]/70">
        <div className="relative max-w-lg mx-auto w-full overflow-visible">
          <div className="absolute top-3 left-3 z-30">
            {onBack && (
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
            )}
          </div>
          {savedMsg && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30">
              <span className="text-[10px] bg-green-500/20 text-green-400 px-2.5 py-1 rounded-full font-bold border border-green-500/30">
                {savedMsg}
              </span>
            </div>
          )}
          <ProfileHeaderSection
            variant="compact"
            userId={user.id}
            username={editing ? form.username || user.username : user.username}
            usernameColor={editing ? form.usernameColor : user.usernameColor}
            usernameWaveFrom={editing ? form.usernameWaveFrom : user.usernameWaveFrom}
            usernameWaveTo={editing ? form.usernameWaveTo : user.usernameWaveTo}
            avatarUrl={headerAvatarUrl}
            profileType={editing ? form.profileType : user.profileType}
            city={editing ? form.city : user.city}
            birthDate={editing ? form.birthDate.trim() : user.birthDate}
            age={editing ? undefined : user.age}
            hideBirthDateOnProfile={
              editing
                ? form.hideBirthDateOnProfile
                : (user.hideBirthDateOnProfile ?? defaultHideBirthDateOnProfile(user))
            }
            showAgeHiddenHint={editing && form.hideBirthDateOnProfile && Boolean(form.birthDate.trim())}
            relationshipStatus={
              editing || user.relationshipStatus === 'autre' ? undefined : user.relationshipStatus
            }
            hasPhotoGallery={!editing && displayPhotos.length > 1}
            onAvatarClick={
              !editing && viewerPhotos.length > 0 ? () => openPhotoViewer(0) : undefined
            }
            topRightAction={
              !editing ? <SettingsGearButton onClick={() => setShowSettings(true)} /> : undefined
            }
            statsRow={
              !editing ? (
                <ProfileStatsRow
                  followers={user.favoritesCount}
                  following={myFavoritesCount}
                  thirdValue={user.stats?.salonsHosted ?? 0}
                  onFollowingClick={() => setShowFavoritesSheet(true)}
                />
              ) : undefined
            }
            bio={
              !editing && user.bio ? (
                <p className="whitespace-pre-wrap break-words">{user.bio}</p>
              ) : !editing ? (
                <p className="text-gray-500 italic text-xs">{t('profile.addBioHint')}</p>
              ) : undefined
            }
            action={
              !editing ? (
                <button
                  type="button"
                  onClick={startEditing}
                  className="w-full min-h-[44px] py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 font-bold text-white text-sm transition shadow-lg shadow-purple-900/30"
                >
                  {t('profile.editProfile')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="w-full min-h-[44px] py-2.5 rounded-xl border border-[#2d2d3d] bg-[#1a1a26]/90 text-sm font-bold text-gray-300"
                >
                  {t('common.cancel')}
                </button>
              )
            }
            hostRatingSlot={
              !editing && showHostRating ? (
                <HostRatingBlock
                  hostId={user.id}
                  hostName={user.username}
                  averageOnly
                  initialRating={user.hostRating}
                />
              ) : undefined
            }
          />
          {!editing && (user.currentListening || user.salonId) && (
            <div className="px-4 pb-2 max-w-lg mx-auto w-full">
              {user.currentListening ? (
                <ProfileCurrentListening
                  listening={user.currentListening}
                  {...(user.salonId && onOpenSalon
                    ? {
                        onClick: () => onOpenSalon(user.salonId!, user.salonTitle, true),
                        clickAriaLabel: 'Ouvrir le salon',
                      }
                    : {})}
                />
              ) : user.salonId && onOpenSalon ? (
                <button
                  type="button"
                  onClick={() => onOpenSalon(user.salonId!, user.salonTitle, true)}
                  className="w-full min-h-[44px] rounded-xl border border-purple-500/30 bg-purple-950/30 px-4 py-3 text-left hover:bg-purple-950/45 transition-colors"
                >
                  <p className="text-[10px] font-bold uppercase tracking-wider text-purple-400">
                    Salon actif
                  </p>
                  <p className="text-sm font-semibold text-white truncate">
                    {user.salonTitle || 'Salon de musique'}
                  </p>
                  <p className="text-xs text-purple-200/80 mt-1">Appuyer pour ouvrir</p>
                </button>
              ) : null}
            </div>
          )}
          {!editing && (
            <ProfileTabBar
              active={profileTab}
              onChange={(id) => {
                setProfileTab(id);
                if (id === 'compositions') setCompositionsRefreshKey((k) => k + 1);
                if (id !== 'reels') setShowReelRecorder(false);
              }}
              showReels={!!onOpenReel}
              showLives
            />
          )}
        </div>
      </div>

      <div
        className={`flex-1 min-h-0 overflow-y-auto px-4 ${editing ? 'pb-[calc(var(--tab-nav-total-h)+5rem)]' : 'pb-[calc(var(--tab-nav-total-h)+2rem)]'}`}
      >
        <div
          className={`max-w-lg mx-auto w-full ${editing ? 'space-y-4 pt-4' : 'space-y-5 pt-4'}`}
        >
        {profileTab === 'lives' && !editing && user && (
          <div className="space-y-4">
            <CreatorDashboardCard />
            <UserLivesSection
              userId={user.id}
              isOwner
              hideSectionTitle
              onOpenLive={onOpenLive}
              onSubscribe={() => setShowSubscription(true)}
            />
          </div>
        )}

        {profileTab === 'reels' && !editing && token && showReelRecorder && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setShowReelRecorder(false)}
              className="text-sm font-semibold text-purple-300 hover:text-white"
            >
              ← Retour à Mes reels
            </button>
            <ProfileReelRecorder
              token={token}
              defaultArtist={user.username}
              onSaved={() => {
                setReelsRefreshKey((k) => k + 1);
                setShowReelRecorder(false);
              }}
            />
          </div>
        )}

        {profileTab === 'reels' && !editing && !showReelRecorder && onOpenReel && user && (
          <UserReelsSection
            userId={user.id}
            isOwner
            layout="grid"
            hideSectionTitle
            defaultOwnerTab="private"
            defaultArtist={user.username}
            onOpenReel={onOpenReel}
            refreshKey={reelsRefreshKey}
            onRecordReel={() => setShowReelRecorder(true)}
          />
        )}

        {profileTab === 'compositions' && !editing && user && (
          <UserCompositionsSection
            defaultArtist={user.username}
            refreshKey={compositionsRefreshKey}
          />
        )}

        {profileTab === 'programmation' && !editing && user && (
          <UserEventsSection userId={user.id} onOpenPost={onOpenFeedPost} />
        )}

        {(profileTab === 'profil' || editing) && (
          <>
        {editing ? (
          <ProfilePhotoGallery
            photos={displayPhotos}
            fallbackSeed={user.id}
            editing
            onBusyChange={setPhotoGalleryBusy}
            onChange={(profilePhotos) =>
              setForm((f) => ({
                ...f,
                profilePhotos,
                avatarUrl: profilePhotos[0] ?? '',
              }))
            }
          />
        ) : (
          <ProfilePhotoGallery
            photos={displayPhotos}
            fallbackSeed={user.id}
            variant="bare"
            galleryOnly
            onPhotoClick={viewerPhotos.length > 0 ? openPhotoViewer : undefined}
          />
        )}

        {!editing ? (
          <>
            <CompactTagChips
              interests={user.interests ?? []}
              genres={user.favoriteGenres ?? []}
              artists={user.favoriteArtists ?? []}
            />

            <section className="space-y-2 pb-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 px-1">
                {t('profile.sectionAccount')}
              </p>
              <div className="rounded-2xl border border-[#1e1e2f] overflow-hidden bg-[#12121a]/40 divide-y divide-[#1e1e2f]">
                <button
                  type="button"
                  onClick={() => setStreamingExpanded((v) => !v)}
                  aria-expanded={streamingExpanded}
                  className={PROFILE_ACCOUNT_ROW_CLASS}
                >
                  <span>{t('profile.connectedAccounts')}</span>
                  <span className="text-gray-500 shrink-0" aria-hidden>
                    {streamingExpanded ? '▾' : '›'}
                  </span>
                </button>
                {streamingExpanded && (
                  <div className="px-4 pb-3 pt-1 space-y-2">
                    <p className="text-[10px] text-gray-500">
                      Obligatoire pour créer ou animer un salon sur la plateforme choisie.
                    </p>
                    {(['youtube'] as const).map((p) => (
                      <PlatformConnectCard
                        key={p}
                        token={token}
                        platform={p}
                        connectedPlatforms={user.connectedPlatforms}
                        platformLinks={user.platformLinks}
                        onUserUpdated={(u) => {
                          setUserFromProfile(u);
                          setForm(profileToForm(u));
                        }}
                      />
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowSubscription(true)}
                  className={PROFILE_ACCOUNT_ROW_CLASS}
                >
                  <span>{t('profile.subscription')}</span>
                  <span className="text-gray-500 shrink-0" aria-hidden>›</span>
                </button>

                {token && user && (
                  <div className="px-4 py-2">
                    <CreatorStripeConnectCard
                      token={token}
                      user={user}
                      onUserUpdated={() => void refreshUser()}
                    />
                  </div>
                )}

                <div className="px-4 py-2">
                  <SupportMeloSongTeaser onOpen={() => setShowDonationSheet(true)} />
                </div>

                <button
                  type="button"
                  onClick={() => setShowContactSoundy(true)}
                  className={PROFILE_ACCOUNT_ROW_CLASS}
                >
                  <span>{t('profile.contactSoundy')}</span>
                  <span className="text-gray-500 shrink-0" aria-hidden>›</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(true)}
                  className={`${PROFILE_ACCOUNT_ROW_CLASS} text-red-400 hover:text-red-300`}
                >
                  <span>{t('profile.logout')}</span>
                </button>
              </div>
            </section>

            <p className="text-[10px] text-gray-600 text-center py-2">
              {t('profile.memberSince', { date: memberDate })}
            </p>
          </>
        ) : (
          <div className="space-y-4">
            <p className="text-sm font-bold text-white">Édition du profil</p>

            <label className="block">
              <span className="text-xs text-gray-400">Pseudo</span>
              <div className="relative mt-1 rounded-xl border border-[#2d2d3d] bg-[#1a1a26] overflow-hidden">
                <div
                  className="absolute inset-0 z-0 flex items-center px-4 py-2 pointer-events-none overflow-hidden"
                  aria-hidden
                >
                  <span
                    className="text-sm font-extrabold truncate w-full min-w-0 text-left bg-clip-text"
                    style={
                      usernameDisplayStyle(form.usernameColor, {
                        from: form.usernameWaveFrom,
                        to: form.usernameWaveTo,
                      }) ?? { color: form.usernameColor || '#ffffff' }
                    }
                  >
                    {form.username || '\u00a0'}
                  </span>
                </div>
                <input
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  maxLength={32}
                  className="relative z-10 w-full bg-transparent border-0 rounded-xl px-4 py-2 text-sm font-extrabold text-transparent selection:bg-purple-500/30"
                  style={{
                    caretColor: isWaveUsernameColor(form.usernameColor)
                      ? resolveUsernameWaveColors({
                          from: form.usernameWaveFrom,
                          to: form.usernameWaveTo,
                        }).from
                      : form.usernameColor || '#ffffff',
                    WebkitTextFillColor: 'transparent',
                    color: 'transparent',
                  }}
                />
              </div>
            </label>
            <UsernameColorPicker
              value={form.usernameColor}
              onChange={(usernameColor) => setForm((f) => ({ ...f, usernameColor }))}
              waveFrom={form.usernameWaveFrom}
              waveTo={form.usernameWaveTo}
              onWaveFromChange={(usernameWaveFrom) => setForm((f) => ({ ...f, usernameWaveFrom }))}
              onWaveToChange={(usernameWaveTo) => setForm((f) => ({ ...f, usernameWaveTo }))}
            />
            <label className="block">
              <span className="text-xs text-gray-400">Bio</span>
              <textarea
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                rows={4}
                maxLength={500}
                placeholder="Parlez de votre rapport à la musique, vos sessions, ce que vous cherchez sur Soundy..."
                className="mt-1 w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-4 py-2 text-white text-sm"
              />
              <span className="text-[10px] text-gray-600">{form.bio.length}/500</span>
            </label>
            <label className="block">
              <span className="text-xs text-gray-400">Ville (optionnel)</span>
              <CityAutocomplete
                value={form.city}
                onChange={(city) => setForm((f) => ({ ...f, city }))}
              />
            </label>
            <div className="block">
              <span className="text-xs text-gray-400">{t('profile.birthDate')}</span>
              <BirthDateInput
                value={form.birthDate}
                onChange={(next) => {
                  setForm((f) => ({
                    ...f,
                    birthDate: next,
                    hideBirthDateOnProfile: next.trim()
                      ? f.birthDate.trim()
                        ? f.hideBirthDateOnProfile
                        : true
                      : true,
                  }));
                }}
              />
              <p className="text-[10px] text-gray-600 mt-1">{t('profile.minAge')}</p>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-[#2d2d3d] bg-[#12121a] px-4 py-3">
              <input
                id={HIDE_AGE_CHECKBOX_ID}
                type="checkbox"
                checked={Boolean(form.hideBirthDateOnProfile)}
                disabled={!form.birthDate.trim()}
                onChange={(e) => {
                  if (!form.birthDate.trim()) return;
                  setForm((f) => ({ ...f, hideBirthDateOnProfile: e.target.checked }));
                }}
                className="mt-0.5 shrink-0 accent-purple-500 disabled:opacity-40 disabled:cursor-not-allowed"
              />
              <label
                htmlFor={HIDE_AGE_CHECKBOX_ID}
                className={`text-sm text-gray-300 min-w-0 ${
                  form.birthDate.trim() ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
                }`}
              >
                {t('profile.hideAge')}
                <span className="block text-[10px] text-gray-500 mt-0.5">
                  {form.birthDate.trim()
                    ? t('profile.hideAgeHint')
                    : t('profile.hideAgeNeedsDate')}
                </span>
              </label>
            </div>
            <label className="block">
              <span className="text-xs text-gray-400">{t('profile.relationshipOptional')}</span>
              <select
                value={form.relationshipStatus}
                onChange={(e) => {
                  const next = e.target.value as RelationshipStatus | '';
                  setForm((f) => ({ ...f, relationshipStatus: next }));
                }}
                className="mt-1 w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-4 py-2 text-white text-sm"
              >
                <option value="">{t('profile.relationshipHidden')}</option>
                <option value="celibataire">{relationshipLabels.celibataire}</option>
                <option value="en_couple">{relationshipLabels.en_couple}</option>
              </select>
              <p className="text-[10px] text-gray-600 mt-1">{t('profile.relationshipHeartHint')}</p>
            </label>

            <label className="block">
              <span className="text-xs text-gray-400">Qui êtes-vous ? (optionnel)</span>
              <select
                value={form.profileType}
                onChange={(e) =>
                  setForm((f) => ({ ...f, profileType: e.target.value as ProfileType | '' }))
                }
                className="mt-1 w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-4 py-2 text-white text-sm"
              >
                <option value="">Ne pas afficher</option>
                {PROFILE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.emoji} {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <EditableTags
              label="Centres d'intérêt"
              tags={form.interests}
              input={form.newInterest}
              onInput={(v) => setForm((f) => ({ ...f, newInterest: v }))}
              onAdd={() => {
                addTag('interests', form.newInterest);
                setForm((f) => ({ ...f, newInterest: '' }));
              }}
              onRemove={(t) => removeTag('interests', t)}
              interestsPreset
              interestCategories={INTEREST_CATEGORIES}
              autocomplete="list"
              searchFn={searchInterests}
              onSelectSuggestion={(v) => {
                addTag('interests', v);
                setForm((f) => ({ ...f, newInterest: '' }));
              }}
            />
            <EditableTags
              label="Genres favoris"
              tags={form.favoriteGenres}
              input={form.newGenre}
              onInput={(v) => setForm((f) => ({ ...f, newGenre: v }))}
              onAdd={() => {
                addTag('favoriteGenres', form.newGenre);
                setForm((f) => ({ ...f, newGenre: '' }));
              }}
              onRemove={(t) => removeTag('favoriteGenres', t)}
              autocomplete="list"
              searchFn={searchGenres}
              placeholder="Ex: Pop, Hardstyle, Jazz…"
              onSelectSuggestion={(v) => {
                addTag('favoriteGenres', v);
                setForm((f) => ({ ...f, newGenre: '' }));
              }}
            />
            <EditableTags
              label="Artistes favoris"
              tags={form.favoriteArtists}
              input={form.newArtist}
              onInput={(v) => setForm((f) => ({ ...f, newArtist: v }))}
              onAdd={() => {
                addTag('favoriteArtists', form.newArtist);
                setForm((f) => ({ ...f, newArtist: '' }));
              }}
              onRemove={(t) => removeTag('favoriteArtists', t)}
              autocomplete="artist"
              onSelectSuggestion={(v) => {
                addTag('favoriteArtists', v);
                setForm((f) => ({ ...f, newArtist: '' }));
              }}
            />

            <div className="space-y-2">
              <span className="text-xs text-gray-400">Comptes connectés</span>
              {(['youtube'] as const).map((p) => (
                <PlatformConnectCard
                  key={p}
                  token={token}
                  platform={p}
                  connectedPlatforms={user.connectedPlatforms}
                  platformLinks={user.platformLinks}
                  onUserUpdated={(u) => {
                    setUserFromProfile(u);
                    setForm((f) => {
                      const next = profileToForm(u);
                      return {
                        ...next,
                        profilePhotos: f.profilePhotos,
                        avatarUrl: f.profilePhotos[0] ?? f.avatarUrl,
                      };
                    });
                  }}
                />
              ))}
            </div>

            {saveError && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                {saveError}
              </p>
            )}

            <button
              type="button"
              onClick={saveProfile}
              disabled={saving}
              className="w-full py-3.5 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold text-white disabled:opacity-50 sticky bottom-[calc(var(--tab-nav-total-h)+0.5rem)] z-10 shadow-lg"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </button>
          </div>
        )}

          </>
        )}
        </div>
      </div>

      {showFavoritesSheet && (
        <MyFavoritesSheet
          token={token}
          onClose={() => setShowFavoritesSheet(false)}
          onOpenProfile={(userId) => {
            setShowFavoritesSheet(false);
            onOpenProfile?.(userId);
          }}
          onFavoritesChanged={setMyFavoritesCount}
        />
      )}

      {showDonationSheet && (
        <DonationSheet onClose={() => setShowDonationSheet(false)} />
      )}

      {photoViewerIndex !== null && viewerPhotos.length > 0 && (
        <ProfilePhotoViewer
          photos={viewerPhotos}
          initialIndex={photoViewerIndex}
          onClose={() => setPhotoViewerIndex(null)}
        />
      )}

      {showLogoutConfirm && (
        <ConfirmModal
          open
          title={t('profile.logoutConfirmTitle')}
          cancelLabel={t('common.cancel')}
          confirmLabel={t('profile.logout')}
          onCancel={() => setShowLogoutConfirm(false)}
          onConfirm={() => {
            setShowLogoutConfirm(false);
            logout();
          }}
        />
      )}
    </div>
  );
}

function ProfileTabBar({
  active,
  onChange,
  showReels,
  showLives,
}: {
  active: ProfileTab;
  onChange: (tab: ProfileTab) => void;
  showReels?: boolean;
  showLives?: boolean;
}) {
  const { t } = useTranslation();
  const tabs: [ProfileTab, string][] = [['profil', t('profile.tabProfil')]];
  if (showReels) tabs.push(['reels', t('profile.tabReels')]);
  tabs.push(['compositions', t('profile.tabCompositions')]);
  tabs.push(['programmation', t('profile.tabProgrammation')]);
  if (showLives) tabs.push(['lives', t('profile.tabLives')]);
  return (
    <div className="border-t border-[#1e1e2f]/80 overflow-x-auto scrollbar-none max-w-lg mx-auto w-full">
      <div className="flex min-w-max sm:min-w-0">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`relative flex-1 min-w-[4.5rem] px-2 py-3 text-[11px] sm:text-xs font-bold uppercase tracking-wider transition ${
              active === id ? 'text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {label}
            {active === id ? (
              <span
                className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] w-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
                style={{ boxShadow: '0 0 8px rgba(168,85,247,0.7)' }}
              />
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}

function ProfileStatsRow({
  followers,
  following,
  thirdValue,
  onFollowingClick,
}: {
  followers?: number | null;
  following?: number | null;
  thirdValue: number;
  onFollowingClick?: () => void;
}) {
  const { t } = useTranslation();
  const items = [
    {
      value: followers != null ? formatCompactCount(followers) : '0',
      label: t('profile.statsFollowers'),
      onClick: undefined as (() => void) | undefined,
    },
    {
      value: following != null ? formatCompactCount(following) : '—',
      label: t('profile.statsFollowing'),
      onClick: onFollowingClick,
    },
    {
      value: formatCompactCount(thirdValue),
      label: t('profile.statsSalons'),
      onClick: undefined as (() => void) | undefined,
    },
  ];

  return (
    <div className="mt-3 w-full max-w-sm rounded-2xl border border-[#1e1e2f] bg-[#12121a]/50 overflow-hidden">
      <div className="grid grid-cols-3 divide-x divide-[#1e1e2f]">
        {items.map((item) => {
          const inner = (
            <>
              <p className="text-base sm:text-lg font-bold text-white tabular-nums">{item.value}</p>
              <p className="text-[10px] text-gray-500 font-medium mt-0.5 leading-tight">{item.label}</p>
            </>
          );
          if (item.onClick) {
            return (
              <button
                key={item.label}
                type="button"
                onClick={item.onClick}
                className="min-h-[56px] px-2 py-2.5 text-center hover:bg-[#1a1a26]/80 transition"
              >
                {inner}
              </button>
            );
          }
          return (
            <div key={item.label} className="min-h-[56px] px-2 py-2.5 text-center">
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const EDIT_TAG_BOX_CLASS =
  'bg-[#12121a] border border-[#1e1e2f] rounded-xl p-3 w-full';

function EditableTags({
  label,
  tags,
  input,
  onInput,
  onAdd,
  onRemove,
  suggestions,
  interestsPreset,
  interestCategories,
  autocomplete,
  searchFn,
  placeholder,
  onSelectSuggestion,
}: {
  label: string;
  tags: string[];
  input: string;
  onInput: (v: string) => void;
  onAdd: () => void;
  onRemove: (t: string) => void;
  suggestions?: string[];
  interestsPreset?: boolean;
  interestCategories?: readonly { label: string; items: readonly string[] }[];
  autocomplete?: 'artist' | 'list';
  searchFn?: (query: string, exclude: string[]) => { label: string; value: string }[];
  placeholder?: string;
  onSelectSuggestion?: (value: string) => void;
}) {
  return (
    <div className={EDIT_TAG_BOX_CLASS}>
      <span className="text-xs text-gray-400">{label}</span>
      <div className="flex flex-wrap gap-2 mt-2 mb-2">
        {tags.map((t) => (
          <span
            key={t}
            className="px-2 py-1 rounded-full bg-purple-500/20 text-purple-200 text-xs flex items-center gap-1"
          >
            {t}
            <button type="button" onClick={() => onRemove(t)} className="text-purple-400 hover:text-white">
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        {autocomplete === 'artist' ? (
          <ArtistAutocomplete
            value={input}
            onChange={onInput}
            exclude={tags}
            placeholder="Ex: Daft Punk, Lomepal…"
            onSelect={(s) => onSelectSuggestion?.(s.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), onAdd())}
          />
        ) : autocomplete === 'list' && searchFn ? (
          <ListAutocomplete
            value={input}
            onChange={onInput}
            exclude={tags}
            searchFn={searchFn}
            placeholder={placeholder ?? 'Ajouter...'}
            onSelect={(v) => onSelectSuggestion?.(v)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), onAdd())}
          />
        ) : (
          <input
            value={input}
            onChange={(e) => onInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), onAdd())}
            className="flex-1 bg-[#1a1a26] border border-[#2d2d3d] rounded-lg px-3 py-2 text-white text-sm"
            placeholder={placeholder ?? 'Ajouter...'}
          />
        )}
        <button type="button" onClick={onAdd} className="px-3 py-2 bg-purple-600 rounded-lg text-white text-sm shrink-0">
          +
        </button>
      </div>
      {interestsPreset && interestCategories && (
        <div className="mt-3 max-h-52 overflow-y-auto space-y-3 pr-1">
          {interestCategories.map((cat) => {
            const available = cat.items.filter((s) => !tags.includes(s));
            if (available.length === 0) return null;
            return (
              <div key={cat.label}>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
                  {cat.label}
                </p>
                <div className="flex flex-wrap gap-2">
                  {available.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => onSelectSuggestion?.(s)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-[#2d2d3d] bg-[#1a1a26] text-xs text-gray-300 hover:border-purple-500/50 hover:text-purple-200 hover:bg-purple-500/10 transition-colors"
                    >
                      <span className="text-purple-400 text-sm leading-none" aria-hidden>
                        +
                      </span>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {!interestsPreset && suggestions && (
        <div className="flex flex-wrap gap-1 mt-2">
          {suggestions
            .filter((s) => !tags.includes(s))
            .slice(0, 5)
            .map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onInput(s)}
                className="text-[10px] text-gray-500 hover:text-purple-400"
              >
                + {s}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
