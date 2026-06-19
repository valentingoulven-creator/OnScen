import { useCallback, useEffect, useState } from 'react';
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
import { AdminPage } from './AdminPage';
import { ContactSoundyPage } from './ContactSoundyPage';
import { PlatformSubscriptionPage } from './PlatformSubscriptionPage';
import { SupportMeloSongTeaser } from '../components/SupportMeloSongSection';
import { DonationSheet } from '../components/DonationSheet';
import { ProfileReelRecorder } from '../components/ProfileReelRecorder';
import { UserReelsSection } from '../components/UserReelsSection';
import { UserCompositionsSection } from '../components/UserCompositionsSection';
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
import type { ProfileType, RelationshipStatus, User } from '../types';

const HIDE_AGE_CHECKBOX_ID = 'profile-hide-age';

const PROFILE_TAB_CLASS =
  'px-4 sm:px-8 py-3 text-sm font-semibold transition relative text-center shrink-0';

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

type ProfileTab = 'profil' | 'reels' | 'compositions' | 'lives';

interface ProfilePageProps {
  onBack?: () => void;
  onOpenReel?: (reelId: string) => void;
  onOpenLive?: (liveId: string) => void;
  onOpenProfile?: (userId: string) => void;
  onOpenSalon?: (salonId: string, salonTitle?: string, isHost?: boolean) => void;
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
  openRecorderOnMount = false,
  onRecorderMountHandled,
  openContactOnMount = false,
  onContactMountHandled,
  highlightSupportMessageId,
}: ProfilePageProps) {
  const { user, token, logout, setUserFromProfile, refreshUser } = useAuth();
  const { t } = useTranslation();
  const [profileTab, setProfileTab] = useState<ProfileTab>('profil');
  const [showReelRecorder, setShowReelRecorder] = useState(false);
  const [reelsRefreshKey, setReelsRefreshKey] = useState(0);
  const [editing, setEditing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);
  const [showContactSoundy, setShowContactSoundy] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
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

  if (showAdmin) {
    return (
      <AdminPage
        onBack={() => setShowAdmin(false)}
        onOpenSalon={(salonId, salonTitle) => {
          setShowAdmin(false);
          onOpenSalon?.(salonId, salonTitle);
        }}
      />
    );
  }

  if (showSettings) {
    return (
      <SettingsPage
        onBack={() => setShowSettings(false)}
        onOpenAdmin={
          user.isAdmin
            ? () => {
                setShowSettings(false);
                setShowAdmin(true);
              }
            : undefined
        }
      />
    );
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
    <div className="flex flex-col h-full overflow-y-auto bg-[#0b0b0f]">
      <div className="relative shrink-0 max-w-lg mx-auto w-full overflow-visible">
        <div className="absolute top-3 left-3 z-10">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-black/40 backdrop-blur border border-white/20 text-white text-lg hover:bg-black/60"
              aria-label="Fermer le profil"
            >
              ←
            </button>
          )}
        </div>
        <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
          {savedMsg && (
            <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-1 rounded-full font-bold">
              {savedMsg}
            </span>
          )}
          {!editing && <SettingsGearButton onClick={() => setShowSettings(true)} />}
        </div>
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
          statsRow={
            !editing ? (
              <ProfileStatsRow
                followers={user.favoritesCount}
                following={myFavoritesCount}
                thirdLabel="Salons"
                thirdValue={user.stats?.salonsHosted ?? 0}
                onFollowingClick={() => setShowFavoritesSheet(true)}
              />
            ) : undefined
          }
          bio={
            !editing && user.bio ? (
              <p className="whitespace-pre-wrap break-words">{user.bio}</p>
            ) : !editing ? (
              <p className="text-gray-500 italic text-xs">Ajoutez une bio via Modifier</p>
            ) : undefined
          }
          action={
            !editing ? (
              <button
                type="button"
                onClick={startEditing}
                className="w-full py-2 rounded-lg border border-[#2d2d3d] bg-transparent hover:bg-[#1a1a26] font-semibold text-white text-sm transition"
              >
                Modifier le profil
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="w-full py-2 rounded-lg border border-[#2d2d3d] bg-[#1a1a26]/90 text-sm font-bold text-gray-300"
              >
                Annuler
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
      </div>

      <div
        className={`px-4 ${editing ? 'pb-[calc(var(--tab-nav-total-h)+5rem)]' : 'pb-[calc(var(--tab-nav-total-h)+2rem)]'}`}
      >
        <div
          className={`max-w-lg mx-auto w-full ${editing ? 'space-y-4' : 'space-y-5'}`}
        >
        {!editing && user.currentListening && (
          <ProfileCurrentListening
            listening={user.currentListening}
            {...(user.salonId && onOpenSalon
              ? {
                  onClick: () => onOpenSalon(user.salonId!, user.salonTitle, true),
                  clickAriaLabel: 'Ouvrir le salon',
                }
              : {})}
          />
        )}
        {!editing && (
          <ProfileTabBar
            active={profileTab}
            onChange={(id) => {
              setProfileTab(id);
              if (id !== 'reels') setShowReelRecorder(false);
            }}
            showReels={!!onOpenReel}
            showLives
          />
        )}

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
            defaultOwnerTab="published"
            defaultArtist={user.username}
            onOpenReel={onOpenReel}
            refreshKey={reelsRefreshKey}
            onRecordReel={() => setShowReelRecorder(true)}
          />
        )}

        {profileTab === 'compositions' && !editing && user && (
          <UserCompositionsSection defaultArtist={user.username} />
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
              <button
                type="button"
                onClick={() => setStreamingExpanded((v) => !v)}
                aria-expanded={streamingExpanded}
                className="relative w-full py-2.5 rounded-lg border border-[#2d2d3d] text-gray-300 font-semibold text-sm text-center hover:bg-[#1a1a26] transition"
              >
                🔗 Comptes connectés
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden>
                  {streamingExpanded ? '▾' : '›'}
                </span>
              </button>
              {streamingExpanded && (
                <div className="space-y-2 pb-1">
                  <p className="text-[10px] text-gray-500">
                    Obligatoire pour créer ou animer un salon sur la plateforme choisie.
                  </p>
                  {(['spotify', 'youtube'] as const).map((p) => (
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
                className="relative w-full py-2.5 rounded-lg border border-[#2d2d3d] text-gray-300 font-semibold text-sm text-center hover:bg-[#1a1a26] transition"
              >
                ✨ {t('profile.subscription')}
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden>
                  ›
                </span>
              </button>

              {token && user && (
                <CreatorStripeConnectCard
                  token={token}
                  user={user}
                  onUserUpdated={() => void refreshUser()}
                />
              )}

              <button
                type="button"
                onClick={() => setShowSettings(true)}
                className="relative w-full py-2.5 rounded-lg border border-[#2d2d3d] text-gray-300 font-semibold text-sm text-center hover:bg-[#1a1a26] transition"
              >
                ⚙️ {t('profile.settings')}
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden>
                  ›
                </span>
              </button>
              <SupportMeloSongTeaser onOpen={() => setShowDonationSheet(true)} />
              <button
                type="button"
                onClick={() => setShowContactSoundy(true)}
                className="w-full py-2.5 rounded-lg border border-[#2d2d3d] text-gray-300 font-semibold text-sm"
              >
                {t('profile.contactSoundy')}
              </button>
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(true)}
                className="w-full py-2.5 rounded-lg border border-[#2d2d3d] text-red-400 font-semibold text-sm"
              >
                {t('profile.logout')}
              </button>
            </section>

            <p className="text-[10px] text-gray-600 text-center py-2">
              Membre depuis {memberDate}
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
              {(['spotify', 'youtube'] as const).map((p) => (
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
  if (showLives) tabs.push(['lives', t('profile.tabLives')]);
  return (
    <div className="border-b border-[#1e1e2f] overflow-x-auto scrollbar-none">
      <div className="flex justify-center min-w-max">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`${PROFILE_TAB_CLASS} ${
              active === id ? 'text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {label}
            {active === id ? (
              <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-white rounded-full" />
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
  thirdLabel,
  thirdValue,
  onFollowingClick,
}: {
  followers?: number | null;
  following?: number | null;
  thirdLabel: string;
  thirdValue: number;
  onFollowingClick?: () => void;
}) {
  const items = [
    {
      value: followers != null ? formatCompactCount(followers) : '0',
      label: 'Vous suivent',
      onClick: undefined as (() => void) | undefined,
    },
    {
      value: following != null ? formatCompactCount(following) : '—',
      label: 'Mes favoris',
      onClick: onFollowingClick,
    },
    {
      value: formatCompactCount(thirdValue),
      label: thirdLabel,
      onClick: undefined as (() => void) | undefined,
    },
  ];

  return (
    <div className="flex justify-center gap-5 sm:gap-8 mt-3 w-full">
      {items.map((item) => {
        const inner = (
          <>
            <p className="text-base font-bold text-white tabular-nums">{item.value}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">{item.label}</p>
          </>
        );
        if (item.onClick) {
          return (
            <button
              key={item.label}
              type="button"
              onClick={item.onClick}
              className="text-center min-w-[4.5rem] hover:opacity-80 transition"
            >
              {inner}
            </button>
          );
        }
        return (
          <div key={item.label} className="text-center min-w-[4.5rem]">
            {inner}
          </div>
        );
      })}
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
