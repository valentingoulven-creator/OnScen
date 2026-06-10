import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MAX_PROFILE_PAYLOAD_CHARS, getUserProfilePhotos, prepareProfilePhotosForSave, profilePhotosChanged, resolveAvatarUrl } from '../lib/profilePhotos';
import {
  defaultHideBirthDateOnProfile,
  todayIsoDate,
  validateBirthDate,
} from '../lib/profileAge';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { ArtistAutocomplete } from '../components/ArtistAutocomplete';
import { CityAutocomplete } from '../components/CityAutocomplete';
import { HostRatingBlock } from '../components/HostRatingBlock';
import { ProfilePhotoGallery } from '../components/ProfilePhotoGallery';
import { SettingsPage, SettingsGearButton } from './SettingsPage';
import { AnalyticsPage } from './AnalyticsPage';
import { AccessManagementPage } from './AccessManagementPage';
import { SupportMeloSongTeaser } from '../components/SupportMeloSongSection';
import { DonationSheet } from '../components/DonationSheet';
import { ProfileReelRecorder } from '../components/ProfileReelRecorder';
import { UserReelsSection } from '../components/UserReelsSection';
import { PlatformConnectCard } from '../components/PlatformConnectCard';
import { UsernameColorPicker } from '../components/UsernameColorPicker';
import { UsernameDisplay } from '../components/UsernameDisplay';
import { USERNAME_COLOR_WAVE, isWaveUsernameColor } from '../lib/usernameColor';
import { ProfileCurrentListening } from '../components/ProfileCurrentListening';
import { MyFavoritesSheet } from '../components/MyFavoritesSheet';
import { formatCompactCount } from '../lib/formatCount';
import { ProfileHeaderSection } from '../components/ProfileHeaderSection';
import { PROFILE_TYPE_OPTIONS } from '../lib/profileTypes';
import type { ProfileType, RelationshipStatus, User } from '../types';

const HIDE_AGE_CHECKBOX_ID = 'profile-hide-age';

const PROFILE_TAB_CLASS =
  'flex-1 py-3 text-sm font-semibold transition relative text-center';

const SUGGESTED_INTERESTS = [
  'Live local',
  'Spotify Jam',
  'YouTube',
  'Découvertes',
  'Écoute partagée',
  'Chill',
  'Club',
  'Indie',
  'Hip-hop',
  'Électro',
];

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
    relationshipStatus: user?.relationshipStatus ?? '',
    relationshipStatusCustom: user?.relationshipStatusCustom ?? '',
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

type ProfileTab = 'profil' | 'reels';

interface ProfilePageProps {
  onBack?: () => void;
  onOpenReel?: (reelId: string) => void;
  onOpenProfile?: (userId: string) => void;
  /** À l’ouverture : Mes reels + enregistreur (ex. depuis profil carte). */
  openRecorderOnMount?: boolean;
  onRecorderMountHandled?: () => void;
}

export function ProfilePage({
  onBack,
  onOpenReel,
  onOpenProfile,
  openRecorderOnMount = false,
  onRecorderMountHandled,
}: ProfilePageProps) {
  const { user, token, logout, setUserFromProfile, refreshUser } = useAuth();
  const { t } = useTranslation();
  const [profileTab, setProfileTab] = useState<ProfileTab>('profil');
  const [showReelRecorder, setShowReelRecorder] = useState(false);
  const [reelsRefreshKey, setReelsRefreshKey] = useState(0);
  const [editing, setEditing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showAccessManagement, setShowAccessManagement] = useState(false);
  const [showFavoritesSheet, setShowFavoritesSheet] = useState(false);
  const [showDonationSheet, setShowDonationSheet] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [myFavoritesCount, setMyFavoritesCount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [streamingExpanded, setStreamingExpanded] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  const [form, setForm] = useState(() => profileToForm(user));

  const relationshipLabels: Record<RelationshipStatus, string> = {
    celibataire: t('profile.relationshipSingle'),
    en_couple: t('profile.relationshipCouple'),
    autre: t('profile.relationshipOther'),
  };

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
    if (form.relationshipStatus === 'autre' && !form.relationshipStatusCustom.trim()) {
      setSaveError(t('profile.relationshipCustomRequired'));
      return;
    }
    setSaving(true);
    setSavedMsg(null);
    setSaveError(null);
    try {
      const currentPhotos = getUserProfilePhotos(user);
      const photosChanged = profilePhotosChanged(currentPhotos, form.profilePhotos);

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
        relationshipStatusCustom:
          form.relationshipStatus === 'autre' ? form.relationshipStatusCustom.trim() || null : null,
        birthDate: birthDateTrim || null,
        hideBirthDateOnProfile: birthDateTrim ? form.hideBirthDateOnProfile : true,
        interests: form.interests,
        favoriteGenres: form.favoriteGenres,
        favoriteArtists: form.favoriteArtists,
      };

      if (photosChanged) {
        body.profilePhotos = await prepareProfilePhotosForSave(form.profilePhotos);
      }

      const payload = JSON.stringify(body);
      if (payload.length > MAX_PROFILE_PAYLOAD_CHARS) {
        throw new Error(
          'Profil trop volumineux (photos). Retirez une photo ou utilisez des images plus légères.'
        );
      }

      const { user: updated } = await api.updateProfile(token, body);
      setUserFromProfile(updated);
      setForm(profileToForm(updated));
      setEditing(false);
      setSavedMsg('Profil enregistré');
      setTimeout(() => setSavedMsg(null), 3000);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Impossible d\'enregistrer le profil';
      setSaveError(message);
      alert(message);
    } finally {
      setSaving(false);
    }
  }, [user, token, form, setUserFromProfile]);

  if (!user || !token) return null;

  if (showAccessManagement) {
    return <AccessManagementPage onBack={() => setShowAccessManagement(false)} />;
  }

  if (showAnalytics) {
    return <AnalyticsPage onBack={() => setShowAnalytics(false)} />;
  }

  if (showSettings) {
    return (
      <SettingsPage
        onBack={() => setShowSettings(false)}
        onOpenAnalytics={user.isAdmin ? () => { setShowSettings(false); setShowAnalytics(true); } : undefined}
        onOpenAccessManagement={user.isAdmin ? () => { setShowSettings(false); setShowAccessManagement(true); } : undefined}
      />
    );
  }

  const memberDate = user.memberSince
    ? new Date(user.memberSince).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    : '—';

  const displayPhotos = editing ? form.profilePhotos : getUserProfilePhotos(user);
  const headerAvatarUrl = editing
    ? displayPhotos.find((url) => url.trim())
    : resolveAvatarUrl(user);

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
      <div className="relative shrink-0">
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
          showAgeHiddenHint={editing && form.hideBirthDateOnProfile && Boolean(form.birthDate.trim())}
          relationshipStatus={editing ? undefined : user.relationshipStatus}
          relationshipStatusCustom={editing ? undefined : user.relationshipStatusCustom}
          hasPhotoGallery={!editing && displayPhotos.length > 1}
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
              <p className="line-clamp-2">{user.bio}</p>
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
        />
      </div>

      <div
        className={`px-4 space-y-4 ${editing ? 'pb-[calc(var(--tab-nav-total-h)+5rem)]' : 'pb-8'}`}
      >
        {!editing && user.currentListening && (
          <ProfileCurrentListening listening={user.currentListening} />
        )}
        {!editing && (
          <ProfileTabBar
            active={profileTab}
            onChange={(id) => {
              setProfileTab(id);
              if (id !== 'reels') setShowReelRecorder(false);
            }}
          />
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

        {(profileTab === 'profil' || editing) && (
          <>
        {editing ? (
          <ProfilePhotoGallery
            photos={displayPhotos}
            fallbackSeed={user.id}
            editing
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
          />
        )}

        {!editing && (
          <p className="text-[10px] text-gray-600 text-center -mt-2">
            Membre depuis {memberDate}
          </p>
        )}

        {(user.listeningRole === 'host' ||
          user.listeningRole === 'les_deux' ||
          (user.stats?.salonsHosted ?? 0) > 0) &&
          !editing && (
            <HostRatingBlock hostId={user.id} hostName={user.username} compact />
          )}

        {!editing ? (
          <>
            <CompactTagChips
              interests={user.interests ?? []}
              genres={user.favoriteGenres ?? []}
              artists={user.favoriteArtists ?? []}
            />

            <button
              type="button"
              onClick={() => setStreamingExpanded((v) => !v)}
              className="w-full flex items-center justify-between py-2.5 text-xs font-semibold text-gray-400 hover:text-white transition"
            >
              <span>Comptes streaming (host)</span>
              <span aria-hidden>{streamingExpanded ? '▾' : '▸'}</span>
            </button>
            {streamingExpanded && (
              <div className="space-y-2 pb-2">
                <p className="text-[10px] text-gray-500">
                  Obligatoire pour créer ou animer un salon sur la plateforme choisie.
                </p>
                {(['spotify', 'youtube', 'instagram'] as const).map((p) => (
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
              onClick={() => setDetailsExpanded((v) => !v)}
              className="w-full flex items-center justify-between py-2.5 text-xs font-semibold text-gray-400 hover:text-white transition border-t border-[#1e1e2f]"
            >
              <span>Paramètres & compte</span>
              <span aria-hidden>{detailsExpanded ? '▾' : '▸'}</span>
            </button>
            {detailsExpanded && (
              <section className="space-y-3 pb-2">
                <p className="text-xs text-gray-500">{user.email}</p>
                <SupportMeloSongTeaser onOpen={() => setShowDonationSheet(true)} />
                <button
                  type="button"
                  onClick={() => setShowSettings(true)}
                  className="w-full py-2.5 rounded-lg border border-[#2d2d3d] text-gray-300 font-semibold text-sm"
                >
                  ⚙️ Paramètres
                </button>
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(true)}
                  className="w-full py-2.5 rounded-lg border border-[#2d2d3d] text-red-400 font-semibold text-sm"
                >
                  {t('profile.logout')}
                </button>
                <p className="text-[10px] text-gray-600 text-center px-2">
                  Votre profil aide les autres à trouver des goûts musicaux communs — pas un profil de rencontre.
                </p>
              </section>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <p className="text-sm font-bold text-white">Édition du profil</p>

            <label className="block">
              <span className="text-xs text-gray-400">Pseudo</span>
              <input
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                maxLength={32}
                className="mt-1 w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-4 py-2 text-white text-sm"
              />
            </label>
            <UsernameColorPicker
              value={form.usernameColor}
              onChange={(usernameColor) => setForm((f) => ({ ...f, usernameColor }))}
              waveFrom={form.usernameWaveFrom}
              waveTo={form.usernameWaveTo}
              onWaveFromChange={(usernameWaveFrom) => setForm((f) => ({ ...f, usernameWaveFrom }))}
              onWaveToChange={(usernameWaveTo) => setForm((f) => ({ ...f, usernameWaveTo }))}
            />
            <div className="rounded-xl border border-[#2d2d3d] bg-[#12121a] px-4 py-3 text-center">
              <p className="text-[10px] text-gray-500 mb-1">Aperçu du pseudo</p>
              <UsernameDisplay
                username={form.username || user.username}
                usernameColor={form.usernameColor}
                usernameWaveFrom={form.usernameWaveFrom}
                usernameWaveTo={form.usernameWaveTo}
                className="text-lg font-extrabold"
              />
            </div>
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
            <label className="block">
              <span className="text-xs text-gray-400">{t('profile.birthDate')}</span>
              <input
                type="date"
                max={todayIsoDate()}
                value={form.birthDate}
                onChange={(e) => {
                  const next = e.target.value;
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
                className="mt-1 w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-4 py-2 text-white text-sm [color-scheme:dark]"
              />
              <p className="text-[10px] text-gray-600 mt-1">{t('profile.minAge')}</p>
            </label>
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

            <label className="block">
              <span className="text-xs text-gray-400">{t('profile.relationshipOptional')}</span>
              <select
                value={form.relationshipStatus}
                onChange={(e) => {
                  const next = e.target.value as RelationshipStatus | '';
                  setForm((f) => ({
                    ...f,
                    relationshipStatus: next,
                    relationshipStatusCustom: next === 'autre' ? f.relationshipStatusCustom : '',
                  }));
                }}
                className="mt-1 w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-4 py-2 text-white text-sm"
              >
                <option value="">{t('profile.relationshipHidden')}</option>
                <option value="celibataire">{relationshipLabels.celibataire}</option>
                <option value="en_couple">{relationshipLabels.en_couple}</option>
                <option value="autre">{relationshipLabels.autre}</option>
              </select>
              {form.relationshipStatus === 'autre' && (
                <input
                  type="text"
                  value={form.relationshipStatusCustom}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, relationshipStatusCustom: e.target.value }))
                  }
                  placeholder={t('profile.relationshipCustomPlaceholder')}
                  maxLength={80}
                  className="mt-2 w-full bg-[#1a1a26] border border-[#2d2d3d] rounded-xl px-4 py-2 text-white text-sm"
                />
              )}
              <p className="text-[10px] text-gray-600 mt-1">{t('profile.relationshipHeartHint')}</p>
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
              suggestions={SUGGESTED_INTERESTS}
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
              <span className="text-xs text-gray-400">Comptes streaming</span>
              {(['spotify', 'youtube', 'instagram'] as const).map((p) => (
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

      {showLogoutConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-confirm-title"
          onClick={() => setShowLogoutConfirm(false)}
        >
          <div
            className="w-full max-w-sm bg-[#12121a] border border-[#2d2d3d] rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5">
              <p id="logout-confirm-title" className="text-lg font-bold text-white">
                {t('profile.logoutConfirmTitle')}
              </p>
            </div>
            <div className="flex gap-2 p-4 border-t border-[#1e1e2f] bg-[#0b0b0f]/50">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-3 rounded-xl border border-[#2d2d3d] text-gray-300 text-sm font-semibold hover:text-white"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLogoutConfirm(false);
                  logout();
                }}
                className="flex-1 py-3 rounded-xl bg-red-600/90 hover:bg-red-500 text-white text-sm font-bold"
              >
                {t('profile.logout')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileTabBar({
  active,
  onChange,
}: {
  active: ProfileTab;
  onChange: (tab: ProfileTab) => void;
}) {
  const tabs: [ProfileTab, string][] = [
    ['profil', 'Profil'],
    ['reels', 'Mes reels'],
  ];
  return (
    <div className="flex border-b border-[#1e1e2f] -mx-4 px-4">
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
            <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-white rounded-full" />
          ) : null}
        </button>
      ))}
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

function CompactTagChips({
  interests,
  genres,
  artists,
}: {
  interests: string[];
  genres: string[];
  artists: string[];
}) {
  const all = [
    ...interests.map((t) => ({ t, color: 'cyan' as const })),
    ...genres.map((t) => ({ t, color: 'purple' as const })),
    ...artists.map((t) => ({ t, color: 'pink' as const })),
  ];
  if (!all.length) return null;

  const colors = {
    cyan: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/25',
    purple: 'bg-purple-500/10 text-purple-300 border-purple-500/25',
    pink: 'bg-pink-500/10 text-pink-300 border-pink-500/25',
  };

  return (
    <div className="-mx-4 px-4 overflow-x-auto scrollbar-none">
      <div className="flex gap-1.5 pb-1 min-w-min">
        {all.map(({ t, color }) => (
          <span
            key={`${color}-${t}`}
            className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] border ${colors[color]}`}
          >
            {t}
          </span>
        ))}
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
  autocomplete,
  onSelectSuggestion,
}: {
  label: string;
  tags: string[];
  input: string;
  onInput: (v: string) => void;
  onAdd: () => void;
  onRemove: (t: string) => void;
  suggestions?: string[];
  autocomplete?: 'artist';
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
        ) : (
          <input
            value={input}
            onChange={(e) => onInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), onAdd())}
            className="flex-1 bg-[#1a1a26] border border-[#2d2d3d] rounded-lg px-3 py-2 text-white text-sm"
            placeholder="Ajouter..."
          />
        )}
        <button type="button" onClick={onAdd} className="px-3 py-2 bg-purple-600 rounded-lg text-white text-sm shrink-0">
          +
        </button>
      </div>
      {suggestions && (
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
