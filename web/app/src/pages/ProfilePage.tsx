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
  toSingleProfilePhotoSlots,
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
import { CityAutocomplete } from '../components/CityAutocomplete';
import { HostRatingBlock } from '../components/HostRatingBlock';
import { ProfilePhotoGallery } from '../components/ProfilePhotoGallery';
import { ProfilePhotoViewer } from '../components/ProfilePhotoViewer';
import { SettingsPage, SettingsGearButton } from './SettingsPage';
import { PlatformSubscriptionPage } from './PlatformSubscriptionPage';
import { ProfileReelRecorder } from '../components/ProfileReelRecorder';
import { UserReelsSection } from '../components/UserReelsSection';
import { UserCompositionsSection } from '../components/UserCompositionsSection';
import { UserEventsSection } from '../components/UserEventsSection';
import { UserLivesSection } from '../components/UserLivesSection';
import { CreatorDashboardCard } from '../components/CreatorDashboardCard';
import { PlatformConnectCard } from '../components/PlatformConnectCard';
import { UsernameColorPicker } from '../components/UsernameColorPicker';
import {
  USERNAME_COLOR_WAVE,
  isWaveUsernameColor,
  resolveUsernameWaveColors,
  usernameDisplayStyle,
} from '../lib/usernameColor';
import { ProfileCurrentListening } from '../components/ProfileCurrentListening';
import { MyFavoritesSheet } from '../components/MyFavoritesSheet';
import { ProfileHeaderSection } from '../components/ProfileHeaderSection';
import { ProfileStatsRow } from '../components/ProfileStatsRow';
import { parseProfileTab, ProfileTabBar, type ProfileTab } from '../components/ProfileTabBar';
import { PROFILE_TYPE_OPTIONS, getProfileTypeOption } from '../lib/profileTypes';
import type { FeedPost, ProfileType, RelationshipStatus, User } from '../types';

const HIDE_AGE_CHECKBOX_ID = 'profile-hide-age';

const EDIT_SECTION_CLASS =
  'rounded-xl border border-[#1e1e2f]/50 bg-[#101018]/90';
const EDIT_LABEL_CLASS =
  'text-[10px] uppercase tracking-wider text-gray-500 font-semibold';
const EDIT_INPUT_CLASS =
  'mt-1 w-full bg-[#16161f] border border-[#2a2a3a] rounded-lg px-2.5 py-1.5 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-purple-500/40 focus:ring-1 focus:ring-purple-500/20 transition';

function profileToForm(user: User | null) {
  const profilePhotos = toSingleProfilePhotoSlots(getUserProfilePhotos(user));
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
  const { user, token, setUserFromProfile, refreshUser } = useAuth();
  const { t } = useTranslation();
  const [profileTab, setProfileTab] = useState<ProfileTab>(() =>
    parseProfileTab(new URLSearchParams(window.location.search).get('tab'))
  );
  const [showReelRecorder, setShowReelRecorder] = useState(false);
  const [reelsRefreshKey, setReelsRefreshKey] = useState(0);
  const [compositionsRefreshKey, setCompositionsRefreshKey] = useState(0);
  const [editing, setEditing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);
  const [showFavoritesSheet, setShowFavoritesSheet] = useState(false);
  const [myFavoritesCount, setMyFavoritesCount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [photoGalleryBusy, setPhotoGalleryBusy] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [photoViewerIndex, setPhotoViewerIndex] = useState<number | null>(null);
  const [editDetailsOpen, setEditDetailsOpen] = useState(false);

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
    setShowSettings(true);
  }, [openContactOnMount]);

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
    setEditDetailsOpen(false);
    setEditing(true);
  }, [user, token, setUserFromProfile]);

  const cancelEditing = useCallback(() => {
    setEditDetailsOpen(false);
    setEditing(false);
    setSaveError(null);
  }, []);

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
      setEditDetailsOpen(false);
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

  if (showSubscription) {
    return <PlatformSubscriptionPage onBack={() => setShowSubscription(false)} />;
  }

  if (showSettings) {
    return (
      <SettingsPage
        onBack={() => setShowSettings(false)}
        openContactOnMount={openContactOnMount}
        onContactMountHandled={onContactMountHandled}
        highlightSupportMessageId={highlightSupportMessageId}
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
  const headerAvatarUrl = editing
    ? displayPhotos.find((url) => url.trim())
    : resolveAvatarUrl(user);
  const mainPhotoViewer =
    !editing && headerAvatarUrl?.trim() ? [headerAvatarUrl.trim()] : [];

  const openPhotoViewer = () => {
    if (mainPhotoViewer.length === 0) return;
    setPhotoViewerIndex(0);
  };

  const addTag = (field: 'interests' | 'favoriteGenres' | 'favoriteArtists', value: string) => {
    const v = value.trim();
    if (!v || form[field].includes(v)) return;
    setForm((f) => ({ ...f, [field]: [...f[field], v] }));
  };

  const removeTag = (field: 'interests' | 'favoriteGenres' | 'favoriteArtists', tag: string) => {
    setForm((f) => ({ ...f, [field]: f[field].filter((t) => t !== tag) }));
  };

  const selectedProfileType = getProfileTypeOption(form.profileType);

  const usernameInput = (
    <label className="block min-w-0 flex-1">
      <span className={EDIT_LABEL_CLASS}>Pseudo</span>
      <div className="relative mt-1 rounded-lg border border-[#2a2a3a] bg-[#16161f] overflow-hidden focus-within:border-purple-500/40 focus-within:ring-1 focus-within:ring-purple-500/20 transition">
        <div
          className="absolute inset-0 z-0 flex items-center px-2.5 py-1.5 pointer-events-none overflow-hidden"
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
          placeholder="Votre pseudo"
          className="relative z-10 w-full bg-transparent border-0 rounded-lg px-2.5 py-1.5 text-sm font-extrabold text-transparent selection:bg-purple-500/30"
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
  );

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#0b0b0f]">
      {editing ? (
        <>
          <header className="shrink-0 flex items-center gap-2 px-2 sm:px-3 py-2 border-b border-[#1e1e2f]/70 bg-[#0b0b0f] ms-safe-area-top">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="w-11 h-11 flex items-center justify-center rounded-full bg-black/45 backdrop-blur-md border border-white/15 text-white hover:bg-black/65 transition shrink-0"
                aria-label={t('common.back')}
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            ) : (
              <span className="w-11 shrink-0" aria-hidden />
            )}
            <h1 className="flex-1 text-center text-sm font-bold text-white truncate px-1">
              Modifier le profil
            </h1>
            <button
              type="button"
              onClick={cancelEditing}
              className="shrink-0 min-h-[44px] px-3 text-xs font-bold text-gray-400 hover:text-white transition"
            >
              {t('common.cancel')}
            </button>
          </header>

          {savedMsg && (
            <div className="shrink-0 px-3 py-1 text-center">
              <span className="text-[10px] bg-green-500/20 text-green-400 px-2.5 py-1 rounded-full font-bold border border-green-500/30">
                {savedMsg}
              </span>
            </div>
          )}

          <div className="flex-1 min-h-0 flex flex-col overflow-hidden max-w-lg mx-auto w-full">
            <div className="flex-1 min-h-0 flex flex-col gap-2.5 px-3 pt-2.5 pb-1 overflow-hidden">
              <section className={`shrink-0 ${EDIT_SECTION_CLASS} p-2.5`}>
                <div className="flex gap-3 items-start">
                  <ProfilePhotoGallery
                    photos={displayPhotos}
                    fallbackSeed={user.id}
                    editing
                    compact
                    onBusyChange={setPhotoGalleryBusy}
                    onChange={(profilePhotos) => {
                      const single = toSingleProfilePhotoSlots(profilePhotos);
                      setForm((f) => ({
                        ...f,
                        profilePhotos: single,
                        avatarUrl: single[0] ?? '',
                      }));
                    }}
                  />
                  {usernameInput}
                </div>
              </section>

              <section className={`shrink-0 ${EDIT_SECTION_CLASS} px-2.5 py-2`}>
                <UsernameColorPicker
                  compact
                  value={form.usernameColor}
                  onChange={(usernameColor) => setForm((f) => ({ ...f, usernameColor }))}
                  waveFrom={form.usernameWaveFrom}
                  waveTo={form.usernameWaveTo}
                  onWaveFromChange={(usernameWaveFrom) =>
                    setForm((f) => ({ ...f, usernameWaveFrom }))
                  }
                  onWaveToChange={(usernameWaveTo) => setForm((f) => ({ ...f, usernameWaveTo }))}
                />
              </section>

              <section className={`shrink-0 ${EDIT_SECTION_CLASS} p-2.5 space-y-2`}>
                <label className="block">
                  <div className="flex items-center justify-between gap-2">
                    <span className={EDIT_LABEL_CLASS}>Bio</span>
                    <span className="text-[9px] text-gray-600 tabular-nums">
                      {form.bio.length}/500
                    </span>
                  </div>
                  <textarea
                    value={form.bio}
                    onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                    rows={2}
                    maxLength={500}
                    placeholder="Votre rapport à la musique, vos sessions…"
                    className={`${EDIT_INPUT_CLASS} resize-none leading-snug min-h-[3.25rem]`}
                  />
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="block min-w-0">
                    <span className={EDIT_LABEL_CLASS}>Ville</span>
                    <CityAutocomplete
                      value={form.city}
                      onChange={(city) => setForm((f) => ({ ...f, city }))}
                      inputClassName={EDIT_INPUT_CLASS}
                      placeholder="Ex. Paris"
                    />
                  </label>
                  <label className="block min-w-0">
                    <span className={EDIT_LABEL_CLASS}>Type de profil</span>
                    <div className="relative mt-1">
                      {selectedProfileType ? (
                        <span
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm pointer-events-none z-10"
                          aria-hidden
                        >
                          {selectedProfileType.emoji}
                        </span>
                      ) : null}
                      <select
                        value={form.profileType}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            profileType: e.target.value as ProfileType | '',
                          }))
                        }
                        className={`${EDIT_INPUT_CLASS} appearance-none pr-8 ${
                          selectedProfileType ? 'pl-8' : ''
                        }`}
                      >
                        <option value="">Choisir…</option>
                        {PROFILE_TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.emoji} {opt.label}
                          </option>
                        ))}
                      </select>
                      <svg
                        viewBox="0 0 24 24"
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        aria-hidden
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                      </svg>
                    </div>
                  </label>
                </div>
              </section>

              <section className={`shrink-0 ${EDIT_SECTION_CLASS} overflow-hidden`}>
                <button
                  type="button"
                  onClick={() => setEditDetailsOpen((open) => !open)}
                  className="flex items-center justify-between w-full min-h-[44px] px-2.5 py-2 text-left transition hover:bg-[#16161f]/60"
                  aria-expanded={editDetailsOpen}
                >
                  <span className="text-xs font-semibold text-gray-300">Plus d&apos;options</span>
                  <svg
                    viewBox="0 0 24 24"
                    className={`w-4 h-4 text-gray-500 transition-transform ${
                      editDetailsOpen ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    aria-hidden
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                  </svg>
                </button>

                {editDetailsOpen ? (
                  <div className="border-t border-[#1e1e2f]/60 px-2.5 py-2 space-y-2 max-h-[min(42dvh,18rem)] overflow-y-auto overscroll-y-contain scrollbar-none">
                    <div className="block">
                      <span className={EDIT_LABEL_CLASS}>{t('profile.birthDate')}</span>
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
                        inputClassName={`${EDIT_INPUT_CLASS} text-xs text-center tabular-nums`}
                      />
                    </div>

                    <label className="flex items-center gap-2.5 rounded-lg border border-[#2a2a3a] bg-[#16161f] px-2.5 py-2 cursor-pointer min-h-[44px]">
                      <input
                        id={HIDE_AGE_CHECKBOX_ID}
                        type="checkbox"
                        checked={Boolean(form.hideBirthDateOnProfile)}
                        disabled={!form.birthDate.trim()}
                        onChange={(e) => {
                          if (!form.birthDate.trim()) return;
                          setForm((f) => ({ ...f, hideBirthDateOnProfile: e.target.checked }));
                        }}
                        className="shrink-0 w-4 h-4 accent-purple-500 disabled:opacity-40"
                      />
                      <span
                        className={`text-xs text-gray-300 min-w-0 ${
                          form.birthDate.trim() ? '' : 'opacity-60'
                        }`}
                      >
                        {t('profile.hideAge')}
                      </span>
                    </label>

                    <label className="block">
                      <span className={EDIT_LABEL_CLASS}>{t('profile.relationshipOptional')}</span>
                      <select
                        value={form.relationshipStatus}
                        onChange={(e) => {
                          const next = e.target.value as RelationshipStatus | '';
                          setForm((f) => ({ ...f, relationshipStatus: next }));
                        }}
                        className={EDIT_INPUT_CLASS}
                      >
                        <option value="">{t('profile.relationshipHidden')}</option>
                        <option value="celibataire">{relationshipLabels.celibataire}</option>
                        <option value="en_couple">{relationshipLabels.en_couple}</option>
                      </select>
                    </label>

                    <EditableTags
                      compact
                      label="Artistes favoris"
                      tags={form.favoriteArtists}
                      input={form.newArtist}
                      onInput={(v) => setForm((f) => ({ ...f, newArtist: v }))}
                      onAdd={() => {
                        addTag('favoriteArtists', form.newArtist);
                        setForm((f) => ({ ...f, newArtist: '' }));
                      }}
                      onRemove={(tag) => removeTag('favoriteArtists', tag)}
                      autocomplete="artist"
                      onSelectSuggestion={(v) => {
                        addTag('favoriteArtists', v);
                        setForm((f) => ({ ...f, newArtist: '' }));
                      }}
                    />

                    <div>
                      <span className={EDIT_LABEL_CLASS}>Comptes connectés</span>
                      <div className="mt-1 space-y-1.5">
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
                    </div>
                  </div>
                ) : null}
              </section>
            </div>

            {saveError ? (
              <p className="shrink-0 mx-3 mb-1 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                {saveError}
              </p>
            ) : null}

            <div className="shrink-0 px-3 pt-2.5 pb-[calc(var(--tab-nav-total-h)+0.75rem)] border-t border-[#1e1e2f]/60 bg-[#0b0b0f]/95 backdrop-blur-sm">
              <button
                type="button"
                onClick={saveProfile}
                disabled={saving || photoGalleryBusy}
                className="w-full min-h-[48px] py-2.5 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 rounded-xl font-bold text-white text-sm disabled:opacity-50 disabled:from-purple-600 disabled:to-purple-500 shadow-lg shadow-purple-900/30 transition"
              >
                {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
              </button>
              {photoGalleryBusy ? (
                <p className="mt-1.5 text-center text-[10px] text-gray-500">
                  Terminez la modification de la photo avant d&apos;enregistrer.
                </p>
              ) : null}
            </div>
          </div>
        </>
      ) : (
        <>
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain pb-[calc(var(--tab-nav-total-h)+2rem)]">
      <div className="shrink-0 border-b border-[#1e1e2f]/70 bg-[#0b0b0f]">
        <div className="relative max-w-lg mx-auto w-full overflow-visible">
          <div className="absolute top-3 left-3 z-40">
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
          <div className="absolute top-3 right-3 z-40">
            <SettingsGearButton onClick={() => setShowSettings(true)} />
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
            username={user.username}
            usernameColor={user.usernameColor}
            usernameWaveFrom={user.usernameWaveFrom}
            usernameWaveTo={user.usernameWaveTo}
            avatarUrl={headerAvatarUrl}
            profileType={user.profileType}
            city={user.city}
            birthDate={user.birthDate}
            age={user.age}
            hideBirthDateOnProfile={
              user.hideBirthDateOnProfile ?? defaultHideBirthDateOnProfile(user)
            }
            relationshipStatus={
              user.relationshipStatus === 'autre' ? undefined : user.relationshipStatus
            }
            onAvatarClick={mainPhotoViewer.length > 0 ? openPhotoViewer : undefined}
            statsRow={
              <ProfileStatsRow
                followers={user.favoritesCount}
                following={myFavoritesCount}
                thirdValue={user.stats?.salonsHosted ?? 0}
                onFollowingClick={() => setShowFavoritesSheet(true)}
              />
            }
            bio={
              user.bio ? (
                <p className="whitespace-pre-wrap break-words">{user.bio}</p>
              ) : (
                <p className="text-gray-500 italic text-xs">{t('profile.addBioHint')}</p>
              )
            }
            action={
              <button
                type="button"
                onClick={startEditing}
                className="min-h-[44px] px-3 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 active:scale-[0.98] font-bold text-white text-xs sm:text-sm transition shadow-lg shadow-purple-900/30 flex items-center justify-center gap-1.5"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-5" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                <span className="hidden sm:inline">{t('profile.editProfile')}</span>
                <span className="sm:hidden">{t('profile.editProfileShort')}</span>
              </button>
            }
            hostRatingSlot={
              showHostRating ? (
                <HostRatingBlock
                  hostId={user.id}
                  hostName={user.username}
                  averageOnly
                  initialRating={user.hostRating}
                />
              ) : undefined
            }
          />
          {(user.currentListening || user.salonId) && (
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
        </div>
      </div>

        <div className="max-w-lg mx-auto w-full px-4 space-y-5 pt-4">
        {profileTab === 'lives' && user && (
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

        {profileTab === 'reels' && token && showReelRecorder && (
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

        {profileTab === 'reels' && !showReelRecorder && onOpenReel && user && (
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

        {profileTab === 'compositions' && user && (
          <UserCompositionsSection
            defaultArtist={user.username}
            refreshKey={compositionsRefreshKey}
          />
        )}

        {profileTab === 'programmation' && user && (
          <UserEventsSection userId={user.id} onOpenPost={onOpenFeedPost} />
        )}

        {profileTab === 'profil' && (
          <p className="text-[10px] text-gray-600 text-center py-2">
            {t('profile.memberSince', { date: memberDate })}
          </p>
        )}
        </div>
      </div>
        </>
      )}

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

      {photoViewerIndex !== null && mainPhotoViewer.length > 0 && (
        <ProfilePhotoViewer
          photos={mainPhotoViewer}
          initialIndex={photoViewerIndex}
          onClose={() => setPhotoViewerIndex(null)}
        />
      )}
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
  compact = false,
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
  compact?: boolean;
}) {
  return (
    <div className={compact ? 'bg-[#16161f] border border-[#2a2a3a] rounded-lg p-2 w-full' : EDIT_TAG_BOX_CLASS}>
      <span className={compact ? EDIT_LABEL_CLASS : 'text-xs text-gray-400'}>{label}</span>
      <div className={`flex flex-wrap gap-1.5 ${compact ? 'mt-1 mb-1' : 'mt-2 mb-2'}`}>
        {tags.map((t, i) => (
          <span
            key={`${t}-${i}`}
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
                  {available.map((s, i) => (
                    <button
                      key={`${cat.label}-${s}-${i}`}
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
            .map((s, i) => (
              <button
                key={`suggestion-${s}-${i}`}
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
