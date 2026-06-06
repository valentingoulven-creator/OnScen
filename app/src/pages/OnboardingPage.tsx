import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { PROFILE_TYPE_OPTIONS } from '../lib/profileTypes';

const MUSIC_GENRES = [
  'Pop', 'Rap', 'Hip-hop', 'R&B', 'Rock', 'Metal',
  'Jazz', 'Soul', 'Blues', 'Classique', 'Électro',
  'House', 'Techno', 'Reggae', 'Afrobeat', 'K-pop',
  'Indie', 'Folk', 'Country', 'Latin', 'Funk',
  'Punk', 'Gospel', 'Lofi', 'Trap', 'Drill',
];

const LISTENING_ROLES = [
  { value: 'auditeur', label: 'Auditeur', emoji: '🎧', desc: 'Je préfère écouter et découvrir' },
  { value: 'host', label: 'Hôte', emoji: '🎤', desc: 'J\'aime animer des salons' },
  { value: 'les_deux', label: 'Les deux', emoji: '🎵', desc: 'J\'aime autant écouter qu\'animer' },
];

type Step = 'genres' | 'profileType' | 'role' | 'profile' | 'done';

const STEPS: Step[] = ['genres', 'profileType', 'role', 'profile', 'done'];

function StepIndicator({ current }: { current: Step }) {
  const activeIndex = STEPS.indexOf(current);
  const labels = ['Genres', 'Identité', 'Rôle', 'Infos', 'Fin'];
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
  const [step, setStep] = useState<Step>('genres');
  const [genres, setGenres] = useState<string[]>([]);
  const [profileType, setProfileType] = useState<string>('');
  const [role, setRole] = useState<string>('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggleGenre = (g: string) => {
    setGenres((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : prev.length < 10 ? [...prev, g] : prev
    );
  };

  const completionPct = (() => {
    let score = 15;
    if (genres.length > 0) score += 20;
    if (profileType) score += 20;
    if (role) score += 15;
    if (bio.trim().length > 10) score += 15;
    if (city.trim()) score += 15;
    return Math.min(score, 100);
  })();

  const saveAndNext = async (nextStep: Step | 'done') => {
    setError('');
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      if (genres.length > 0) body.favoriteGenres = genres;
      if (profileType) body.profileType = profileType;
      if (role) body.listeningRole = role;
      if (bio.trim()) body.bio = bio.trim();
      if (city.trim()) body.city = city.trim();

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

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-6 bg-[#0b0b0f]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 items-center justify-center text-xl mb-3">
            ♪
          </div>
          <h1 className="text-2xl font-extrabold text-white">Bienvenue{user?.username ? `, ${user.username}` : ''} !</h1>
          <p className="text-gray-400 text-sm mt-1">Personnalisez votre expérience Soundly</p>
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
                onClick={() => saveAndNext('profileType')}
                className="text-xs text-gray-500 hover:text-gray-300 px-3 py-2"
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
              <button type="button" onClick={() => setStep('genres')} className="text-xs text-gray-500 hover:text-gray-300 px-3 py-2">← Retour</button>
              <button
                type="button"
                onClick={() => saveAndNext('role')}
                className="text-xs text-gray-500 hover:text-gray-300 px-2 py-2"
              >
                Passer
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => saveAndNext('role')}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-50 transition"
              >
                {saving ? '…' : 'Continuer →'}
              </button>
            </div>
          </div>
        )}

        {step === 'role' && (
          <div className="bg-[#12121a] border border-[#1e1e2f] rounded-2xl p-5 space-y-4">
            <div>
              <h2 className="text-base font-bold text-white">Votre rôle sur Soundly</h2>
              <p className="text-xs text-gray-400 mt-0.5">Comment utilisez-vous l'application ?</p>
            </div>
            <div className="space-y-2">
              {LISTENING_ROLES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRole(r.value)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition text-left ${
                    role === r.value
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-[#2d2d3d] bg-[#1a1a26] hover:border-purple-500/40'
                  }`}
                >
                  <span className="text-2xl shrink-0">{r.emoji}</span>
                  <div>
                    <p className="text-sm font-semibold text-white">{r.label}</p>
                    <p className="text-xs text-gray-400">{r.desc}</p>
                  </div>
                  {role === r.value && (
                    <span className="ml-auto text-purple-400 shrink-0">✓</span>
                  )}
                </button>
              ))}
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setStep('profileType')} className="text-xs text-gray-500 hover:text-gray-300 px-3 py-2">← Retour</button>
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
              <input
                type="text"
                placeholder="Ex : Paris, Lyon, Montréal…"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                maxLength={80}
                className="w-full bg-[#0b0b0f] border border-[#2d2d3d] rounded-xl px-4 py-2.5 text-sm text-white"
              />
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
              <button type="button" onClick={() => setStep('role')} className="text-xs text-gray-500 hover:text-gray-300 px-3 py-2">← Retour</button>
              <button
                type="button"
                disabled={saving}
                onClick={() => saveAndNext('done')}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-50 transition"
              >
                {saving ? '…' : 'Terminer 🎉'}
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onDone}
          className="w-full mt-3 text-xs text-gray-600 hover:text-gray-400 transition py-2"
        >
          Passer l'onboarding — compléter plus tard
        </button>
      </div>
    </div>
  );
}
