import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { PROFILE_TYPE_OPTIONS } from '../lib/profileTypes';
import { ArtistAutocomplete } from '../components/ArtistAutocomplete';
import { CityAutocomplete } from '../components/CityAutocomplete';
import { PlatformConnectCard } from '../components/PlatformConnectCard';
import { PLATFORM_STATUS_REFRESH_EVENT } from '../lib/platformStatusEvents';
import { getPrivacyPreferences, setPrivacyPreferences } from '../lib/settings';
import { compressProfilePhotoDataUrl, prepareProfilePhotosForSave } from '../lib/profilePhotos';
import { validateBirthDate } from '../lib/profileAge';
import { BirthDateInput } from '../components/BirthDateInput';
import { validateImageFileAsync } from '../lib/imageConstraints';
import { prepareImageFile } from '../lib/imageUtils';
import { ConfirmModal } from '../components/ConfirmModal';

const MUSIC_GENRES = [
  'Pop', 'Rap', 'Hip-hop', 'R&B', 'Rock', 'Metal',
  'Jazz', 'Soul', 'Blues', 'Classique', 'Électro',
  'House', 'Techno', 'Reggae', 'Afrobeat', 'K-pop',
  'Indie', 'Folk', 'Country', 'Latin', 'Funk',
  'Punk', 'Gospel', 'Lofi', 'Trap', 'Drill',
];

type Step = 'genres' | 'artists' | 'profileType' | 'platforms' | 'socials' | 'profile' | 'photos' | 'location' | 'done';

const STEPS: Step[] = ['genres', 'artists', 'profileType', 'platforms', 'socials', 'profile', 'photos', 'location', 'done'];

function StepIndicator({ current }: { current: Step }) {
  const activeIndex = STEPS.indexOf(current);
  const labels = ['Genres', 'Artistes', 'Identité', 'Plateformes', 'Réseaux', 'Infos', 'Photos', 'Position', 'Fin'];
  return (
    <div className="flex items-center gap-0 w-full max-w-xs mx-auto mb-6">
      {STEPS.map((step, i) => (
        <div key={step} className="flex items-center flex-1">
          <div
            title={labels[i]}
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
            i < activeIndex
              ? 'bg-purple-500 text-white'
              : i === activeIndex
                ? 'bg-purple-600 text-white ring-2 ring-purple-400/40'
                : 'bg-[#2d2d3d] text-gray-500'
          }`}
          >
            {i < activeIndex ? '✓' : i + 1}
          </div>
          {i < STEPS.length - 1 && (
            <div className={`flex-1 h-0.5 mx-1 transition-colors ${i < activeIndex ? 'bg-purple-500' : 'bg-[#2d2d3d]'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function CompletionBadge({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-2 bg-purple-500/10 border border-purple-500/30 rounded-xl px-3 py-2 mb-4">
      <div className="relative w-8 h-8 shrink-0">
        <svg viewBox="0 0 36 36" className="w-8 h-8 -rotate-90">
          <circle cx="18" cy="18" r="15" fill="none" stroke="#2d2d3d" strokeWidth="3" />
          <circle
            cx="18" cy="18" r="15"
            fill="none"
            stroke="#a855f7"
            strokeWidth="3"
            strokeDasharray={`${(pct / 100) * 94.25} 94.25`}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-purple-400">
          {pct}%
        </span>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-white">Profil complété à {pct}%</p>
        <p className="text-[10px] text-gray-400">Complétez votre profil pour être mieux mis en avant</p>
      </div>
    </div>
  );
}

interface Props {
  onDone: () => void;
}

export function OnboardingPage({ onDone }: Props) {
  const { user, token, setUserFromProfile } = useAuth();
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('genres');
  const [genres, setGenres] = useState<string[]>([]);
  const [favoriteArtists, setFavoriteArtists] = useState<string[]>([]);
  const [newArtist, setNewArtist] = useState('');
  const [profileType, setProfileType] = useState<string>('');
  const [bio, setBio] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [hideBirthDateOnProfile, setHideBirthDateOnProfile] = useState(true);
  const [city, setCity] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [youtubeChannel, setYoutubeChannel] = useState('');
  const [relationshipStatus, setRelationshipStatus] = useState<'celibataire' | 'en_couple' | ''>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [deletePhotoIndex, setDeletePhotoIndex] = useState<number | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [oauthConfigured, setOauthConfigured] = useState(false);
  const [hasRealPlatformConnection, setHasRealPlatformConnection] = useState(false);
  const [platformStatusLoading, setPlatformStatusLoading] = useState(true);
  const [instagramOAuthAvailable, setInstagramOAuthAvailable] = useState(false);

  const refreshPlatformRequirement = useCallback(() => {
    if (!token) {
      setPlatformStatusLoading(false);
      return;
    }
    setPlatformStatusLoading(true);
    api
      .getPlatformStatus(token)
      .then((s) => {
        setOauthConfigured(s.oauthConfigured ?? (s.spotifyOAuthAvailable || s.youtubeOAuthAvailable));
        setHasRealPlatformConnection(s.hasRealPlatformConnection ?? false);
        setInstagramOAuthAvailable(s.instagramOAuthAvailable ?? false);
      })
      .catch(() => {
        setOauthConfigured(false);
        setHasRealPlatformConnection(false);
        setInstagramOAuthAvailable(false);
      })
      .finally(() => setPlatformStatusLoading(false));
  }, [token]);

  useEffect(() => {
    refreshPlatformRequirement();
  }, [refreshPlatformRequirement, user?.connectedPlatforms]);

  useEffect(() => {
    const onRefresh = () => refreshPlatformRequirement();
    window.addEventListener(PLATFORM_STATUS_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(PLATFORM_STATUS_REFRESH_EVENT, onRefresh);
  }, [refreshPlatformRequirement]);

  const toggleGenre = (g: string) => {
    setGenres((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : prev.length < 10 ? [...prev, g] : prev
    );
  };

  const openPhotoPicker = () => {
    if (photos.length >= 5 || saving) return;
    if (photoInputRef.current) {
      photoInputRef.current.value = '';
      photoInputRef.current.click();
    }
  };

  const handleOnboardingPhotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = await validateImageFileAsync(file);
    if (!validation.valid) {
      setError(validation.error ?? 'Fichier non valide');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const prepared = await prepareImageFile(file);
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(prepared);
      });
      const compressed = await compressProfilePhotoDataUrl(dataUrl);
      setPhotos((prev) => (prev.length < 5 ? [...prev, compressed] : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement de la photo');
    } finally {
      setSaving(false);
    }
  };

  const requestRemoveOnboardingPhoto = (idx: number) => {
    setDeletePhotoIndex(idx);
  };

  const confirmRemoveOnboardingPhoto = () => {
    if (deletePhotoIndex === null) return;
    setPhotos((prev) => prev.filter((_, i) => i !== deletePhotoIndex));
    setDeletePhotoIndex(null);
  };

  const completionPct = (() => {
    let score = 10;
    if (genres.length > 0) score += 20;
    if (profileType) score += 20;
    if (bio.trim().length > 10) score += 20;
    if (birthDate.trim()) score += 5;
    if (city.trim()) score += 10;
    if (photos.length > 0) score += 10;
    return Math.min(score, 100);
  })();

  const saveAndNext = async (nextStep: Step | 'done') => {
    setError('');
    const birthDateTrim = birthDate.trim();
    if (birthDateTrim) {
      const birthError = validateBirthDate(birthDateTrim);
      if (birthError) {
        setError(
          birthError === 'birthDateInvalid'
            ? 'Date de naissance invalide.'
            : birthError === 'birthDateFuture'
              ? 'La date de naissance ne peut pas être dans le futur.'
              : "L'âge doit être entre 13 et 120 ans."
        );
        return;
      }
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      if (genres.length > 0) body.favoriteGenres = genres;
      if (favoriteArtists.length > 0) body.favoriteArtists = favoriteArtists;
      if (profileType) body.profileType = profileType;
      if (bio.trim()) body.bio = bio.trim();
      if (birthDateTrim) {
        body.birthDate = birthDateTrim;
        body.hideBirthDateOnProfile = hideBirthDateOnProfile;
      }
      if (city.trim()) body.city = city.trim();
      const cleanIG = instagramHandle.trim().replace(/^@/, '');
      if (cleanIG) body.instagramHandle = cleanIG;
      if (youtubeChannel.trim()) body.youtubeChannel = youtubeChannel.trim();
      if (relationshipStatus) body.relationshipStatus = relationshipStatus;

      if (photos.length > 0) {
        body.profilePhotos = await prepareProfilePhotosForSave(photos);
      }

      if (Object.keys(body).length > 0 && token) {
        const { user: updated } = await api.updateProfile(token, body);
        setUserFromProfile(updated);
      }

      if (nextStep === 'done') {
        onDone();
      } else {
        setStep(nextStep);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const handleAllowLocation = () => {
    if (!navigator.geolocation) {
      setPrivacyPreferences({ ...getPrivacyPreferences(), locationSharing: true });
      onDone();
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setPrivacyPreferences({ ...getPrivacyPreferences(), locationSharing: true });
        if (token) {
          try {
            await api.updateGeo(token, pos.coords.latitude, pos.coords.longitude);
          } catch {
            // best-effort — don't block onboarding completion
          }
        }
        setLocating(false);
        onDone();
      },
      () => {
        // Permission denied or error — respect choice
        setPrivacyPreferences({ ...getPrivacyPreferences(), locationSharing: false });
        setLocating(false);
        onDone();
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleSkipLocation = () => {
    setPrivacyPreferences({ ...getPrivacyPreferences(), locationSharing: false });
    onDone();
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-6 bg-[#0b0b0f]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 items-center justify-center text-xl mb-3">
            ♪
          </div>
          <h1 className="text-2xl font-extrabold text-white">Bienvenue{user?.username ? `, ${user.username}` : ''} !</h1>
          <p className="text-gray-400 text-sm mt-1">Personnalisez votre expérience Soundy</p>
        </div>

        <CompletionBadge pct={completionPct} />
        <StepIndicator current={step} />

        {step === 'genres' && (
          <div className="bg-[#12121a] border border-[#1e1e2f] rounded-2xl p-5 space-y-4">
            <div>
              <h2 className="text-base font-bold text-white">Vos genres musicaux</h2>
              <p className="text-xs text-gray-400 mt-0.5">Choisissez jusqu'à 10 genres qui vous ressemblent</p>
            </div>
            <div className="flex flex-wrap gap-2 max-h-52 overflow-y-auto">
              {MUSIC_GENRES.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => toggleGenre(g)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                    genres.includes(g)
                      ? 'bg-purple-600 text-white'
                      : 'bg-[#1a1a26] text-gray-400 border border-[#2d2d3d] hover:border-purple-500/50'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
            {genres.length > 0 && (
              <p className="text-[11px] text-purple-400">{genres.length} genre{genres.length > 1 ? 's' : ''} sélectionné{genres.length > 1 ? 's' : ''}</p>
            )}
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => saveAndNext('artists')}
                className="text-xs text-gray-500 hover:text-gray-300 px-3 py-2"
              >
                Passer
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => saveAndNext('artists')}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-50 transition"
              >
                {saving ? '…' : 'Continuer →'}
              </button>
            </div>
          </div>
        )}

        {step === 'artists' && (
          <div className="bg-[#12121a] border border-[#1e1e2f] rounded-2xl p-5 space-y-4">
            <div>
              <h2 className="text-base font-bold text-white">Artistes favoris</h2>
              <p className="text-xs text-gray-400 mt-0.5">Ajoutez vos artistes préférés pour personnaliser votre expérience</p>
            </div>
            <div className="space-y-2">
              {favoriteArtists.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {favoriteArtists.map((a) => (
                    <span
                      key={a}
                      className="px-2 py-1 rounded-full bg-purple-500/20 text-purple-200 text-xs flex items-center gap-1"
                    >
                      {a}
                      <button
                        type="button"
                        onClick={() => setFavoriteArtists((prev) => prev.filter((t) => t !== a))}
                        className="text-purple-400 hover:text-white"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <ArtistAutocomplete
                  value={newArtist}
                  onChange={setNewArtist}
                  exclude={favoriteArtists}
                  placeholder="Ex: Daft Punk, Lomepal…"
                  onSelect={(s) => {
                    const v = s.value.trim();
                    if (v && !favoriteArtists.includes(v)) setFavoriteArtists((prev) => [...prev, v]);
                    setNewArtist('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const v = newArtist.trim();
                      if (v && !favoriteArtists.includes(v)) setFavoriteArtists((prev) => [...prev, v]);
                      setNewArtist('');
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const v = newArtist.trim();
                    if (v && !favoriteArtists.includes(v)) setFavoriteArtists((prev) => [...prev, v]);
                    setNewArtist('');
                  }}
                  className="px-3 py-2 bg-purple-600 rounded-lg text-white text-sm shrink-0"
                >
                  +
                </button>
              </div>
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setStep('genres')} className="text-xs text-gray-500 hover:text-gray-300 px-3 py-2">← Retour</button>
              <button
                type="button"
                onClick={() => saveAndNext('profileType')}
                className="text-xs text-gray-500 hover:text-gray-300 px-2 py-2"
              >
                Passer
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => saveAndNext('profileType')}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-50 transition"
              >
                {saving ? '…' : 'Continuer →'}
              </button>
            </div>
          </div>
        )}

        {step === 'profileType' && (
          <div className="bg-[#12121a] border border-[#1e1e2f] rounded-2xl p-5 space-y-4">
            <div>
              <h2 className="text-base font-bold text-white">Qui êtes-vous ?</h2>
              <p className="text-xs text-gray-400 mt-0.5">Bar, artiste, lieu, professionnel de la musique…</p>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-0.5">
              {PROFILE_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setProfileType(opt.value)}
                  className={`flex items-start gap-2 p-2.5 rounded-xl border text-left transition ${
                    profileType === opt.value
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-[#2d2d3d] bg-[#1a1a26] hover:border-purple-500/40'
                  }`}
                >
                  <span className="text-lg shrink-0 leading-none">{opt.emoji}</span>
                  <span className="text-[11px] font-semibold text-white leading-tight">{opt.label}</span>
                </button>
              ))}
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setStep('artists')} className="text-xs text-gray-500 hover:text-gray-300 px-3 py-2">← Retour</button>
              <button
                type="button"
                onClick={() => saveAndNext('platforms')}
                className="text-xs text-gray-500 hover:text-gray-300 px-2 py-2"
              >
                Passer
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => saveAndNext('platforms')}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-50 transition"
              >
                {saving ? '…' : 'Continuer →'}
              </button>
            </div>
          </div>
        )}

        {step === 'platforms' && token && (
          <div className="bg-[#12121a] border border-[#1e1e2f] rounded-2xl p-5 space-y-4">
            <div>
              <h2 className="text-base font-bold text-white">Connecte tes plateformes</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Lie YouTube pour héberger des salons avec ta musique.
              </p>
            </div>
            {!platformStatusLoading && oauthConfigured && !hasRealPlatformConnection && (
              <p className="text-xs text-gray-400 bg-[#0b0b0f] border border-[#2d2d3d] rounded-xl px-3 py-2 leading-snug">
                Tu pourras connecter une plateforme plus tard depuis ton profil.
              </p>
            )}
            {!platformStatusLoading && !oauthConfigured && (
              <p className="text-xs text-gray-500 bg-[#0b0b0f] border border-[#2d2d3d] rounded-xl px-3 py-2 leading-snug">
                OAuth non configuré sur le serveur (admin :{' '}
                <span className="text-gray-400">GOOGLE_CLIENT_*</span>). Tu peux passer cette étape
                et utiliser la connexion démo YouTube si disponible.
              </p>
            )}
            <div className="space-y-2">
              {(['youtube'] as const).map((p) => (
                <PlatformConnectCard
                  key={p}
                  token={token}
                  platform={p}
                  connectedPlatforms={user?.connectedPlatforms}
                  onUserUpdated={(u) => {
                    setUserFromProfile(u);
                    refreshPlatformRequirement();
                  }}
                />
              ))}
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setStep('profileType')} className="text-xs text-gray-500 hover:text-gray-300 px-3 py-2">← Retour</button>
              <button
                type="button"
                onClick={() => setStep('socials')}
                className="text-xs text-gray-500 hover:text-gray-300 px-2 py-2"
              >
                Passer
              </button>
              <button
                type="button"
                disabled={saving || platformStatusLoading}
                onClick={() => setStep('socials')}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-50 transition"
              >
                {platformStatusLoading ? '…' : 'Continuer →'}
              </button>
            </div>
          </div>
        )}

        {step === 'socials' && (
          <div className="bg-[#12121a] border border-[#1e1e2f] rounded-2xl p-5 space-y-4">
            <div>
              <h2 className="text-base font-bold text-white">Tes réseaux sociaux</h2>
              <p className="text-xs text-gray-400 mt-0.5">Optionnel — connecte tes profils pour plus de visibilité</p>
            </div>

            {instagramOAuthAvailable && token && (
              <div className="space-y-2 pb-3 border-b border-[#2d2d3d]">
                <p className="text-[10px] text-pink-400 font-semibold uppercase tracking-wide">📸 Instagram Pro</p>
                <PlatformConnectCard
                  token={token}
                  platform="instagram"
                  connectedPlatforms={user?.connectedPlatforms}
                  onUserUpdated={(u) => setUserFromProfile(u)}
                />
              </div>
            )}

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="flex items-center gap-1.5 text-xs text-gray-400">
                  <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                  Instagram
                </label>
                <div className="flex items-center bg-[#0b0b0f] border border-[#2d2d3d] rounded-xl overflow-hidden">
                  <span className="px-3 text-gray-500 text-sm select-none">@</span>
                  <input
                    type="text"
                    placeholder="tonpseudo"
                    value={instagramHandle}
                    onChange={(e) => setInstagramHandle(e.target.value.replace(/^@+/, ''))}
                    maxLength={64}
                    className="flex-1 bg-transparent py-2.5 pr-4 text-sm text-white outline-none"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="flex items-center gap-1.5 text-xs text-gray-400">
                  <svg className="w-3.5 h-3.5 shrink-0 text-red-500" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                  </svg>
                  YouTube
                </label>
                <input
                  type="text"
                  placeholder="Nom de ta chaîne ou URL"
                  value={youtubeChannel}
                  onChange={(e) => setYoutubeChannel(e.target.value)}
                  maxLength={200}
                  className="w-full bg-[#0b0b0f] border border-[#2d2d3d] rounded-xl px-4 py-2.5 text-sm text-white"
                />
              </div>
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setStep('platforms')} className="text-xs text-gray-500 hover:text-gray-300 px-3 py-2">← Retour</button>
              <button
                type="button"
                onClick={() => saveAndNext('profile')}
                className="text-xs text-gray-500 hover:text-gray-300 px-2 py-2"
              >
                Passer
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => saveAndNext('profile')}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-50 transition"
              >
                {saving ? '…' : 'Continuer →'}
              </button>
            </div>
          </div>
        )}

        {step === 'profile' && (
          <div className="bg-[#12121a] border border-[#1e1e2f] rounded-2xl p-5 space-y-4">
            <div>
              <h2 className="text-base font-bold text-white">Votre profil</h2>
              <p className="text-xs text-gray-400 mt-0.5">Ces informations sont optionnelles</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-400">Ville</label>
              <CityAutocomplete
                value={city}
                onChange={setCity}
                placeholder="Ex : Paris, Lyon, Montréal…"
                inputClassName="w-full bg-[#0b0b0f] border border-[#2d2d3d] rounded-xl px-4 py-2.5 text-sm text-white"
              />
            </div>
            <div className="space-y-1">
              <span className="text-xs text-gray-400">Date de naissance (optionnel)</span>
              <BirthDateInput
                value={birthDate}
                onChange={(next) => {
                  setBirthDate(next);
                  if (!next.trim()) setHideBirthDateOnProfile(true);
                }}
                inputClassName="mt-0.5 w-full bg-[#0b0b0f] border border-[#2d2d3d] rounded-xl px-3 py-2.5 text-sm text-white text-center tabular-nums"
              />
              <p className="text-[10px] text-gray-600">Minimum 13 ans (CGU)</p>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-[#2d2d3d] bg-[#0b0b0f] px-4 py-3">
              <input
                id="onboarding-hide-age"
                type="checkbox"
                checked={hideBirthDateOnProfile}
                disabled={!birthDate.trim()}
                onChange={(e) => {
                  if (!birthDate.trim()) return;
                  setHideBirthDateOnProfile(e.target.checked);
                }}
                className="mt-0.5 shrink-0 accent-purple-500 disabled:opacity-40 disabled:cursor-not-allowed"
              />
              <label
                htmlFor="onboarding-hide-age"
                className={`text-sm text-gray-300 min-w-0 ${
                  birthDate.trim() ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
                }`}
              >
                {t('profile.hideAge')}
                <span className="block text-[10px] text-gray-500 mt-0.5">
                  {birthDate.trim()
                    ? t('profile.hideAgeHint')
                    : t('profile.hideAgeNeedsDate')}
                </span>
              </label>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-400">{t('profile.relationshipOptional')}</label>
              <select
                value={relationshipStatus}
                onChange={(e) => setRelationshipStatus(e.target.value as 'celibataire' | 'en_couple' | '')}
                className="w-full bg-[#0b0b0f] border border-[#2d2d3d] rounded-xl px-4 py-2.5 text-sm text-white"
              >
                <option value="">{t('profile.relationshipHidden')}</option>
                <option value="celibataire">{t('profile.relationshipSingle')}</option>
                <option value="en_couple">{t('profile.relationshipCouple')}</option>
              </select>
              <p className="text-[10px] font-medium mt-1" style={{ color: '#c084fc' }}>
                {t('profile.relationshipHeartHintOnboarding')}
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-400">Bio</label>
              <textarea
                placeholder="Décrivez vos goûts musicaux, ce qui vous anime…"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={500}
                rows={3}
                className="w-full bg-[#0b0b0f] border border-[#2d2d3d] rounded-xl px-4 py-2.5 text-sm text-white resize-none"
              />
              <p className="text-[10px] text-gray-600 text-right">{bio.length}/500</p>
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setStep('socials')} className="text-xs text-gray-500 hover:text-gray-300 px-3 py-2">← Retour</button>
              <button
                type="button"
                disabled={saving}
                onClick={() => saveAndNext('photos')}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-50 transition"
              >
                {saving ? '…' : 'Continuer →'}
              </button>
            </div>
          </div>
        )}

        {step === 'photos' && (
          <div className="bg-[#12121a] border border-[#1e1e2f] rounded-2xl p-5 space-y-4">
            <div>
              <h2 className="text-base font-bold text-white">Tes photos (jusqu'à 5)</h2>
              <p className="text-xs text-gray-400 mt-0.5">La première photo sera ton avatar principal</p>
            </div>

            <div>
              <p className="text-[10px] text-purple-400 font-semibold uppercase tracking-wide mb-2">Photo principale</p>
              <div className="flex justify-center">
                {photos[0] ? (
                  <div className="relative w-36 h-36 rounded-2xl overflow-hidden border-2 border-purple-500/40">
                    <img src={photos[0]} alt="" className="w-full h-full object-cover" />
                    <span className="absolute top-1 left-1 text-[8px] bg-purple-600 text-white px-1.5 py-0.5 rounded font-bold">
                      Principal
                    </span>
                    <button
                      type="button"
                      onClick={() => requestRemoveOnboardingPhoto(0)}
                      className="absolute top-0 left-0 z-10 w-6 h-6 rounded-full bg-black/75 border border-white/20 text-white text-xs flex items-center justify-center hover:bg-red-600/90 transition"
                      aria-label="Supprimer l'avatar"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={openPhotoPicker}
                    disabled={saving}
                    className="w-36 h-36 rounded-2xl border-2 border-dashed border-[#2d2d3d] flex flex-col items-center justify-center gap-1 text-gray-500 hover:border-purple-500/50 hover:text-purple-400 transition disabled:opacity-50"
                  >
                    <span className="text-3xl leading-none">+</span>
                    <span className="text-[10px]">Avatar</span>
                  </button>
                )}
              </div>
            </div>

            <div>
              <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide mb-2">Photos supplémentaires</p>
              <div className="grid grid-cols-2 gap-2">
                {[1, 2, 3, 4].map((idx) => {
                  if (photos[idx]) {
                    return (
                      <div key={idx} className="relative rounded-xl overflow-hidden aspect-square">
                        <img src={photos[idx]} alt="" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => requestRemoveOnboardingPhoto(idx)}
                          className="absolute top-0 left-0 z-10 w-6 h-6 rounded-full bg-black/75 border border-white/20 text-white text-xs flex items-center justify-center hover:bg-red-600/90 transition"
                          aria-label="Supprimer la photo"
                        >
                          ×
                        </button>
                      </div>
                    );
                  }
                  if (idx <= photos.length) {
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={openPhotoPicker}
                        disabled={saving}
                        className="border-2 border-dashed border-[#2d2d3d] rounded-xl aspect-square flex items-center justify-center text-gray-500 hover:border-purple-500/50 hover:text-purple-400 transition disabled:opacity-50"
                      >
                        <span className="text-2xl leading-none">+</span>
                      </button>
                    );
                  }
                  return (
                    <div
                      key={idx}
                      className="border-2 border-dashed border-[#1e1e2f] rounded-xl aspect-square flex items-center justify-center"
                    >
                      <span className="text-2xl leading-none text-[#2d2d3d]">+</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleOnboardingPhotoFile}
            />

            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setStep('profile')} className="text-xs text-gray-500 hover:text-gray-300 px-3 py-2">← Retour</button>
              <button
                type="button"
                onClick={() => saveAndNext('location')}
                className="text-xs text-gray-500 hover:text-gray-300 px-2 py-2"
              >
                Passer
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => saveAndNext('location')}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-50 transition"
              >
                {saving ? '…' : 'Continuer →'}
              </button>
            </div>
          </div>
        )}

        {step === 'location' && (
          <div className="bg-[#12121a] border border-[#1e1e2f] rounded-2xl p-5 space-y-5">
            <div className="text-center space-y-3 py-2">
              <div className="inline-flex w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 items-center justify-center text-3xl">
                📍
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Partage ta position</h2>
                <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                  Soundy utilise ta position pour afficher les salons, lives et personnes musicales près de toi. Ta position exacte n'est jamais partagée publiquement.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <button
                type="button"
                disabled={locating}
                onClick={handleAllowLocation}
                className="w-full py-3 rounded-xl font-bold text-sm text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-60 transition flex items-center justify-center gap-2"
              >
                {locating ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Localisation…
                  </>
                ) : (
                  '📍 Autoriser'
                )}
              </button>
              <button
                type="button"
                disabled={locating}
                onClick={handleSkipLocation}
                className="w-full py-2.5 rounded-xl text-sm text-gray-400 bg-[#1a1a26] hover:bg-[#22222f] disabled:opacity-50 transition"
              >
                Pas maintenant
              </button>
            </div>
            <p className="text-[10px] text-gray-600 text-center">
              Tu pourras activer le partage de position plus tard dans Paramètres → Confidentialité.
            </p>
          </div>
        )}

      </div>

      <ConfirmModal
        open={deletePhotoIndex !== null}
        title="Supprimer cette photo ?"
        description="La photo sera retirée de votre profil."
        onCancel={() => setDeletePhotoIndex(null)}
        onConfirm={confirmRemoveOnboardingPhoto}
      />
    </div>
  );
}
