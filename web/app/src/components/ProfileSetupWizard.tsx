import { useRef, useState } from 'react';
import { api } from '../lib/api';
import { PROFILE_TYPE_OPTIONS, getProfileTypeOption } from '../lib/profileTypes';
import { CityAutocomplete } from './CityAutocomplete';
import { BirthDateInput } from './BirthDateInput';
import { getPrivacyPreferences, setPrivacyPreferences } from '../lib/settings';
import { compressProfilePhotoDataUrl, prepareProfilePhotosForSave } from '../lib/profilePhotos';
import { validateBirthDate, computeAgeFromBirthDate, birthDateErrorMessage } from '../lib/profileAge';
import { validateImageFileAsync } from '../lib/imageConstraints';
import { prepareImageFile } from '../lib/imageUtils';
import { ConfirmModal } from './ConfirmModal';
import type { User } from '../types';

type Step = 'profile' | 'location';

const STEPS: Step[] = ['profile', 'location'];

function StepIndicator({ current }: { current: Step }) {
  const activeIndex = STEPS.indexOf(current);
  const labels = ['Profil', 'Position'];
  return (
    <div className="flex items-center gap-0 w-full max-w-[12rem] mx-auto mb-4">
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

function PrivacySwitch({
  hidden,
  onChange,
  disabled = false,
  label,
}: {
  hidden: boolean;
  onChange: (hidden: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 min-h-[36px]">
      <span className="text-[10px] text-gray-500">{label}</span>
      <div className="flex rounded-lg border border-[#2d2d3d] p-0.5 bg-[#0b0b0f] shrink-0">
        <button
          type="button"
          onClick={() => onChange(false)}
          disabled={disabled}
          className={`px-2.5 py-1 rounded-md text-[10px] font-semibold min-h-[32px] transition ${
            !hidden ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-gray-300'
          } disabled:opacity-40`}
        >
          Visible
        </button>
        <button
          type="button"
          onClick={() => onChange(true)}
          disabled={disabled}
          className={`px-2.5 py-1 rounded-md text-[10px] font-semibold min-h-[32px] transition ${
            hidden ? 'bg-[#2d2d3d] text-gray-200' : 'text-gray-500 hover:text-gray-300'
          } disabled:opacity-40`}
        >
          Caché
        </button>
      </div>
    </div>
  );
}

export interface ProfileSetupWizardProps {
  token: string;
  username?: string;
  title?: string;
  subtitle?: string;
  onProfileUpdate?: (user: User) => void;
  onDone: () => void | Promise<void>;
}

export function ProfileSetupWizard({
  token,
  username,
  title = 'Bienvenue',
  subtitle = 'Personnalisez votre expérience OnScen',
  onProfileUpdate,
  onDone,
}: ProfileSetupWizardProps) {
  const [step, setStep] = useState<Step>('profile');
  const [profileType, setProfileType] = useState<string>('');
  const [city, setCity] = useState('');
  const [bio, setBio] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [hideBirthDateOnProfile, setHideBirthDateOnProfile] = useState(true);
  const [showAge, setShowAge] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [locating, setLocating] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [deletePhotoIndex, setDeletePhotoIndex] = useState<number | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const completionPct = (() => {
    let score = 15;
    if (profileType) score += 20;
    if (city.trim()) score += 15;
    if (photos.length > 0) score += 15;
    if (bio.trim().length > 10) score += 20;
    if (birthDate.trim()) score += 15;
    return Math.min(score, 100);
  })();

  const birthDateTrimmed = birthDate.trim();
  const derivedAge = birthDateTrimmed ? computeAgeFromBirthDate(birthDateTrimmed) : null;
  const birthPrivacyDisabled = !birthDateTrimmed;
  const birthDateError = birthDateTrimmed ? validateBirthDate(birthDateTrimmed) : null;
  const birthDateValid = birthDateTrimmed ? birthDateError === null : false;
  const profileStepReady = Boolean(profileType && city.trim() && birthDateValid);

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

  const saveAndNext = async (nextStep: Step | 'done') => {
    setError('');
    if (step === 'profile' && nextStep === 'location') {
      if (!profileType) {
        setError('Choisissez un type de profil.');
        return;
      }
      if (!city.trim()) {
        setError('Indiquez votre ville.');
        return;
      }
      if (!birthDateTrimmed) {
        setError('Indiquez votre date de naissance.');
        return;
      }
    }
    if (birthDateTrimmed) {
      const birthError = validateBirthDate(birthDateTrimmed);
      if (birthError) {
        setError(birthDateErrorMessage(birthError));
        return;
      }
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      if (profileType) body.profileType = profileType;
      if (city.trim()) body.city = city.trim();
      if (bio.trim()) body.bio = bio.trim();
      if (birthDateTrimmed) {
        body.birthDate = birthDateTrimmed;
        body.hideBirthDateOnProfile = hideBirthDateOnProfile;
        body.showAge = showAge;
      }

      if (photos.length > 0) {
        body.profilePhotos = await prepareProfilePhotosForSave(photos);
      }

      if (Object.keys(body).length > 0) {
        const { user: updated } = await api.updateProfile(token, body);
        onProfileUpdate?.(updated);
      }

      if (nextStep === 'done') {
        await onDone();
      } else {
        setStep(nextStep);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const finishWizard = async () => {
    await onDone();
  };

  const handleAllowLocation = () => {
    if (!navigator.geolocation) {
      setPrivacyPreferences({ ...getPrivacyPreferences(), locationSharing: true });
      void finishWizard();
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setPrivacyPreferences({ ...getPrivacyPreferences(), locationSharing: true });
        try {
          await api.updateGeo(token, pos.coords.latitude, pos.coords.longitude);
        } catch {
          // best-effort
        }
        setLocating(false);
        await finishWizard();
      },
      () => {
        setPrivacyPreferences({ ...getPrivacyPreferences(), locationSharing: false });
        setLocating(false);
        void finishWizard();
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleSkipLocation = () => {
    setPrivacyPreferences({ ...getPrivacyPreferences(), locationSharing: false });
    void finishWizard();
  };

  const selectedProfileType = getProfileTypeOption(profileType);
  const welcomeTitle = username ? `${title}, ${username} !` : `${title} !`;

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-5 sm:p-6 bg-[#0b0b0f]">
      <div className="w-full max-w-sm">
        <div className={`text-center ${step === 'profile' ? 'mb-3' : 'mb-6'}`}>
          {step !== 'profile' ? (
            <div className="inline-flex w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 items-center justify-center text-xl mb-3">
              ♪
            </div>
          ) : null}
          <h1 className={`font-extrabold text-white ${step === 'profile' ? 'text-xl' : 'text-2xl'}`}>
            {step === 'profile' ? 'Qui êtes-vous sur OnScen ?' : welcomeTitle}
          </h1>
          {step !== 'profile' && subtitle ? (
            <p className="text-gray-400 text-sm mt-1">{subtitle}</p>
          ) : null}
        </div>

        {step === 'location' ? <CompletionBadge pct={completionPct} /> : null}
        <StepIndicator current={step} />

        {step === 'profile' && (
          <div className="bg-[#12121a] border border-[#1e1e2f] rounded-2xl p-4 space-y-3">
            <div className="flex gap-3 items-start">
              <div className="shrink-0 flex flex-col items-center gap-1">
                <button
                  type="button"
                  onClick={openPhotoPicker}
                  disabled={saving}
                  className="relative group disabled:opacity-50"
                  aria-label={photos[0] ? 'Modifier la photo de profil' : 'Ajouter une photo de profil'}
                >
                  <div className="p-[2px] rounded-full bg-gradient-to-tr from-purple-600 via-fuchsia-500 to-pink-500">
                    <div className="w-[4.5rem] h-[4.5rem] rounded-full overflow-hidden bg-[#1a1a26] border-2 border-[#0b0b0f] flex items-center justify-center">
                      {photos[0] ? (
                        <img src={photos[0]} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-2xl text-gray-500 group-hover:text-purple-300 transition">👤</span>
                      )}
                    </div>
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-7 h-7 rounded-full bg-purple-600 border-2 border-[#12121a] text-white text-xs flex items-center justify-center">
                    {photos[0] ? '✎' : '+'}
                  </span>
                </button>
                {photos[0] ? (
                  <button
                    type="button"
                    onClick={() => requestRemoveOnboardingPhoto(0)}
                    className="text-[10px] text-gray-500 hover:text-red-400 transition px-1 min-h-[32px]"
                  >
                    Retirer
                  </button>
                ) : null}
              </div>

              <div className="flex-1 min-w-0 space-y-2 pt-1">
                <label className="block space-y-1">
                  <span className="text-[11px] font-medium text-gray-400">
                    Je suis… <span className="text-purple-400">*</span>
                  </span>
                  <div className="relative">
                    {selectedProfileType ? (
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none z-10" aria-hidden>
                        {selectedProfileType.emoji}
                      </span>
                    ) : null}
                    <select
                      value={profileType}
                      onChange={(e) => setProfileType(e.target.value)}
                      className={`w-full appearance-none bg-[#0b0b0f] border border-[#2d2d3d] rounded-xl py-2.5 text-sm text-white min-h-[44px] pr-9 ${
                        selectedProfileType ? 'pl-9' : 'pl-3'
                      }`}
                    >
                      <option value="">Choisir un type…</option>
                      {PROFILE_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.emoji} {opt.label}
                        </option>
                      ))}
                    </select>
                    <svg
                      viewBox="0 0 24 24"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      aria-hidden
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                    </svg>
                  </div>
                </label>

                <label className="block space-y-1">
                  <span className="text-[11px] font-medium text-gray-400">
                    Ville <span className="text-purple-400">*</span>
                  </span>
                  <CityAutocomplete
                    value={city}
                    onChange={setCity}
                    placeholder="Paris, Lyon…"
                    inputClassName="w-full bg-[#0b0b0f] border border-[#2d2d3d] rounded-xl px-3 py-2.5 text-sm text-white min-h-[44px]"
                  />
                </label>
              </div>
            </div>

            <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handleOnboardingPhotoFile} />

            <section className="rounded-xl border border-[#1e1e2f] bg-[#0f0f16] p-3 space-y-2">
              <label className="block space-y-1">
                <span className="text-[11px] font-medium text-gray-400">Bio</span>
                <textarea
                  placeholder="Quelques mots sur vous…"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={500}
                  rows={2}
                  className="w-full bg-[#0b0b0f] border border-[#2d2d3d] rounded-xl px-3 py-2 text-sm text-white resize-none leading-relaxed"
                />
              </label>
            </section>

            <section className="rounded-xl border border-[#1e1e2f] bg-[#0f0f16] p-3 space-y-2">
              <label className="block space-y-1">
                <span className="text-[11px] font-medium text-gray-400">
                  Date de naissance <span className="text-purple-400">*</span>
                </span>
                <BirthDateInput
                  value={birthDate}
                  onChange={(next) => {
                    setBirthDate(next);
                    if (!next.trim()) {
                      setHideBirthDateOnProfile(true);
                      setShowAge(true);
                    }
                  }}
                  inputClassName="w-full bg-[#0b0b0f] border border-[#2d2d3d] rounded-xl px-3 py-2 text-sm text-white text-center tabular-nums min-h-[44px]"
                />
              </label>
              {birthDateError ? (
                <p className="text-xs text-red-400 leading-relaxed" role="alert">
                  {birthDateErrorMessage(birthDateError)}
                </p>
              ) : derivedAge != null ? (
                <p className="text-[11px] text-gray-400 tabular-nums">
                  Âge : <span className="text-gray-200 font-medium">{derivedAge} ans</span>
                </p>
              ) : null}
              <PrivacySwitch
                label="Date de naissance sur le profil"
                hidden={hideBirthDateOnProfile}
                disabled={birthPrivacyDisabled}
                onChange={setHideBirthDateOnProfile}
              />
              <PrivacySwitch
                label="Âge sur le profil public"
                hidden={!showAge}
                disabled={birthPrivacyDisabled}
                onChange={(hidden) => setShowAge(!hidden)}
              />
            </section>

            {error ? <p className="text-xs text-red-400 text-center">{error}</p> : null}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={saving || !profileStepReady}
                onClick={() => saveAndNext('location')}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 disabled:opacity-50 transition min-h-[44px]"
              >
                {saving ? 'Enregistrement…' : 'Continuer →'}
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
                  OnScen utilise ta position pour afficher les salons, lives et personnes musicales près de toi. Ta position exacte n&apos;est jamais partagée publiquement.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <button
                type="button"
                disabled={locating}
                onClick={handleAllowLocation}
                className="w-full py-3 rounded-xl font-bold text-sm text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-60 transition flex items-center justify-center gap-2 min-h-[44px]"
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
                className="w-full py-2.5 rounded-xl text-sm text-gray-400 bg-[#1a1a26] hover:bg-[#22222f] disabled:opacity-50 transition min-h-[44px]"
              >
                Pas maintenant
              </button>
            </div>
            <button
              type="button"
              disabled={locating}
              onClick={() => setStep('profile')}
              className="w-full text-sm text-gray-500 hover:text-gray-300 py-2.5 min-h-[44px] transition disabled:opacity-50"
            >
              ← Retour au profil
            </button>
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
