import { useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { PROFILE_TYPE_OPTIONS } from '../lib/profileTypes';
import { ArtistAutocomplete } from '../components/ArtistAutocomplete';
import { CityAutocomplete } from '../components/CityAutocomplete';
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

type Step = 'taste' | 'profile' | 'location';

const STEPS: Step[] = ['taste', 'profile', 'location'];

function StepIndicator({ current }: { current: Step }) {
  const activeIndex = STEPS.indexOf(current);
  const labels = ['Goûts', 'Profil', 'Position'];
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
  const [step, setStep] = useState<Step>('taste');
  const [genres, setGenres] = useState<string[]>([]);
  const [favoriteArtists, setFavoriteArtists] = useState<string[]>([]);
  const [newArtist, setNewArtist] = useState('');
  const [profileType, setProfileType] = useState<string>('');
  const [bio, setBio] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [hideBirthDateOnProfile, setHideBirthDateOnProfile] = useState(true);
  const [city, setCity] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [deletePhotoIndex, setDeletePhotoIndex] = useState<number | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const toggleGenre = (g: string) => {
    setGenres((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : prev.length < 10 ? [...prev, g] : prev
    );
  };

  const openPhotoPicker = () => {
    if (photos.length >= 1 || saving) return;
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
      setPhotos([compressed]);
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

        {step === 'taste' && (
          <div className="bg-[#12121a] border border-[#1e1e2f] rounded-2xl p-5 space-y-4 max-h-[70dvh] overflow-y-auto">
            <div>
              <h2 className="text-base font-bold text-white">Vos goûts musicaux</h2>
              <p className="text-xs text-gray-400 mt-0.5">Genres et artistes pour personnaliser votre fil</p>
            </div>
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
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
            <div className="space-y-2 pt-2 border-t border-[#2d2d3d]">
              <p className="text-xs text-gray-400">Artistes favoris (optionnel)</p>
              {favoriteArtists.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {favoriteArtists.map((a) => (
                    <span key={a} className="px-2 py-1 rounded-full bg-purple-500/20 text-purple-200 text-xs flex items-center gap-1">
                      {a}
                      <button type="button" onClick={() => setFavoriteArtists((prev) => prev.filter((t) => t !== a))} className="text-purple-400 hover:text-white">×</button>
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
                  className="px-3 py-2 bg-purple-600 rounded-lg text-white text-sm shrink-0 min-h-[44px]"
                >
                  +
                </button>
              </div>
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => saveAndNext('profile')} className="text-xs text-gray-500 hover:text-gray-300 px-3 py-2 min-h-[44px]">Passer</button>
              <button type="button" disabled={saving} onClick={() => saveAndNext('profile')} className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-50 transition min-h-[44px]">
                {saving ? '…' : 'Continuer →'}
              </button>
            </div>
          </div>
        )}

        {step === 'profile' && (
          <div className="bg-[#12121a] border border-[#1e1e2f] rounded-2xl p-5 space-y-4 max-h-[70dvh] overflow-y-auto">
            <div>
              <h2 className="text-base font-bold text-white">Votre profil</h2>
              <p className="text-xs text-gray-400 mt-0.5">Identité, photo et infos — tout est optionnel</p>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-0.5">
              {PROFILE_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setProfileType(opt.value)}
                  className={`flex items-start gap-2 p-2.5 rounded-xl border text-left transition ${
                    profileType === opt.value ? 'border-purple-500 bg-purple-500/10' : 'border-[#2d2d3d] bg-[#1a1a26] hover:border-purple-500/40'
                  }`}
                >
                  <span className="text-lg shrink-0 leading-none">{opt.emoji}</span>
                  <span className="text-[11px] font-semibold text-white leading-tight">{opt.label}</span>
                </button>
              ))}
            </div>
            <div className="flex justify-center">
              {photos[0] ? (
                <div className="relative w-28 h-28 rounded-2xl overflow-hidden border-2 border-purple-500/40">
                  <img src={photos[0]} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => requestRemoveOnboardingPhoto(0)} className="absolute top-0 left-0 z-10 w-11 h-11 rounded-full bg-black/75 border border-white/20 text-white text-sm flex items-center justify-center hover:bg-red-600/90 transition" aria-label="Supprimer la photo">×</button>
                </div>
              ) : (
                <button type="button" onClick={openPhotoPicker} disabled={saving} className="w-28 h-28 rounded-2xl border-2 border-dashed border-[#2d2d3d] flex flex-col items-center justify-center gap-1 text-gray-500 hover:border-purple-500/50 hover:text-purple-400 transition disabled:opacity-50">
                  <span className="text-3xl leading-none">+</span>
                  <span className="text-[10px]">Photo</span>
                </button>
              )}
            </div>
            <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handleOnboardingPhotoFile} />
            <div className="space-y-1">
              <label className="text-xs text-gray-400">Ville</label>
              <CityAutocomplete value={city} onChange={setCity} placeholder="Ex : Paris, Lyon…" inputClassName="w-full bg-[#0b0b0f] border border-[#2d2d3d] rounded-xl px-4 py-2.5 text-sm text-white" />
            </div>
            <div className="space-y-1">
              <span className="text-xs text-gray-400">Date de naissance (optionnel)</span>
              <BirthDateInput value={birthDate} onChange={(next) => { setBirthDate(next); if (!next.trim()) setHideBirthDateOnProfile(true); }} inputClassName="mt-0.5 w-full bg-[#0b0b0f] border border-[#2d2d3d] rounded-xl px-3 py-2.5 text-sm text-white text-center tabular-nums" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-400">Bio</label>
              <textarea placeholder="Décrivez vos goûts musicaux…" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} rows={2} className="w-full bg-[#0b0b0f] border border-[#2d2d3d] rounded-xl px-4 py-2.5 text-sm text-white resize-none" />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setStep('taste')} className="text-xs text-gray-500 hover:text-gray-300 px-3 py-2 min-h-[44px]">← Retour</button>
              <button type="button" onClick={() => saveAndNext('location')} className="text-xs text-gray-500 hover:text-gray-300 px-2 py-2 min-h-[44px]">Passer</button>
              <button type="button" disabled={saving} onClick={() => saveAndNext('location')} className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-50 transition min-h-[44px]">
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
