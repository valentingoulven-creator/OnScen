import { useState } from 'react';
import { type LegalKey } from '../content/legal';
import { LegalDocumentView } from '../components/LegalDocumentView';
import { SUPPORT } from '../content/support';
import { SupportMeloSongSection } from '../components/SupportMeloSongSection';
import { setLivesGeoRadiusKm } from '../lib/livesGeo';
import {
  getNearbyRadiusKm,
  setNearbyRadiusKm,
  clampNearbyRadiusKm,
  formatRadiusKm,
  NEARBY_RADIUS_HARD_MAX,
  NEARBY_RADIUS_MAX,
  NEARBY_RADIUS_MIN,
  getAppLanguage,
  setAppLanguage,
  getPrivacyPreferences,
  setPrivacyPreferences,
  type AppLanguage,
  type PrivacyPreferences,
} from '../lib/settings';
import {
  getFeedAlgorithmPreferences,
  setFeedAlgorithmPreferences,
  notifyFeedAlgorithmChanged,
  BUILTIN_ALGORITHM_WEIGHTS,
  DEFAULT_CUSTOM_WEIGHTS,
  type ReelFeedAlgorithmPreferences,
  type ReelFeedAlgorithmWeights,
} from '../lib/reelFeedAlgorithm';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

type PasswordStrength = 'vide' | 'faible' | 'moyen' | 'fort';

function getPasswordStrength(pwd: string): PasswordStrength {
  if (!pwd) return 'vide';
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 1) return 'faible';
  if (score <= 3) return 'moyen';
  return 'fort';
}

const STRENGTH_CONFIG: Record<PasswordStrength, { label: string; color: string; bars: number }> = {
  vide:   { label: '',       color: 'bg-gray-700',   bars: 0 },
  faible: { label: 'Faible', color: 'bg-red-500',    bars: 1 },
  moyen:  { label: 'Moyen',  color: 'bg-yellow-400', bars: 2 },
  fort:   { label: 'Fort',   color: 'bg-green-500',  bars: 3 },
};

function PasswordStrengthBar({ password }: { password: string }) {
  const strength = getPasswordStrength(password);
  const cfg = STRENGTH_CONFIG[strength];
  if (!password) return null;
  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${i < cfg.bars ? cfg.color : 'bg-gray-700'}`}
          />
        ))}
      </div>
      {cfg.label && (
        <p className={`text-[11px] font-medium ${
          strength === 'faible' ? 'text-red-400' : strength === 'moyen' ? 'text-yellow-400' : 'text-green-400'
        }`}>
          Sécurité : {cfg.label}
        </p>
      )}
    </div>
  );
}


interface SettingsPageProps {
  onBack: () => void;
  onOpenAnalytics?: () => void;
  onOpenAccessManagement?: () => void;
}

function GearIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
      />
    </svg>
  );
}

export function SettingsGearButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Paramètres"
      aria-label="Paramètres"
      className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur border border-white/20 text-gray-200 hover:text-white transition"
    >
      <GearIcon className="w-5 h-5" />
    </button>
  );
}

function SettingsRow({
  label,
  hint,
  onClick,
  children,
}: {
  label: string;
  hint?: string;
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-3 p-4 text-left ${
        onClick ? 'hover:bg-[#1a1a26] active:bg-[#1a1a26]' : ''
      }`}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white">{label}</p>
        {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
      </div>
      {children ?? (onClick && <span className="text-gray-500 shrink-0">›</span>)}
    </Tag>
  );
}

export function SettingsPage({ onBack, onOpenAnalytics, onOpenAccessManagement }: SettingsPageProps) {
  const { token, logout } = useAuth();
  const [radiusKm, setRadiusKm] = useState(getNearbyRadiusKm);
  const [language, setLanguage] = useState<AppLanguage>(getAppLanguage);
  const [privacy, setPrivacy] = useState<PrivacyPreferences>(getPrivacyPreferences);
  const [legal, setLegal] = useState<LegalKey | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [feedAlgo, setFeedAlgo] = useState<ReelFeedAlgorithmPreferences>(getFeedAlgorithmPreferences);

  // Password change state
  const [pwSection, setPwSection] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  // Delete account state
  const [deleteModal, setDeleteModal] = useState(false);
  const [deletePwd, setDeletePwd] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    if (newPwd.length < 8) {
      setPwError('Le nouveau mot de passe doit contenir au moins 8 caractères');
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwError('Les mots de passe ne correspondent pas');
      return;
    }
    if (getPasswordStrength(newPwd) === 'faible') {
      setPwError('Mot de passe trop faible. Ajoutez des chiffres, majuscules ou symboles');
      return;
    }
    setPwLoading(true);
    try {
      await api.changePassword(token!, currentPwd, newPwd);
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
      setPwSection(false);
      flash('Mot de passe mis à jour');
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setPwLoading(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError('');
    if (deleteConfirmText !== 'SUPPRIMER') {
      setDeleteError('Tapez exactement SUPPRIMER pour confirmer');
      return;
    }
    setDeleteLoading(true);
    try {
      await api.deleteAccount(token!, deletePwd);
      logout();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setDeleteLoading(false);
    }
  };

  const flash = (msg: string) => {
    setSaved(msg);
    setTimeout(() => setSaved(null), 2000);
  };

  const applyRadius = (v: number) => {
    if (!Number.isFinite(v)) return;
    const clamped = clampNearbyRadiusKm(v);
    setRadiusKm(clamped);
    setNearbyRadiusKm(clamped);
    setLivesGeoRadiusKm(clamped);
    flash('Distance mise à jour');
  };

  const applyLanguage = (lang: AppLanguage) => {
    setLanguage(lang);
    setAppLanguage(lang);
    flash(lang === 'fr' ? 'Langue : français' : 'Language: English');
  };

  const applyPrivacy = (next: PrivacyPreferences) => {
    setPrivacy(next);
    setPrivacyPreferences(next);
    flash('Préférences enregistrées');
  };

  const applyFeedAlgo = (next: ReelFeedAlgorithmPreferences) => {
    setFeedAlgo(next);
    setFeedAlgorithmPreferences(next);
    notifyFeedAlgorithmChanged();
    flash(
      next.useBuiltInAlgorithm
        ? 'Algorithme Soundly activé'
        : 'Tri personnalisé des Reels activé'
    );
  };

  const updateFeedWeight = (key: keyof ReelFeedAlgorithmWeights, value: number) => {
    applyFeedAlgo({
      ...feedAlgo,
      weights: { ...feedAlgo.weights, [key]: value },
    });
  };

  if (legal) {
    return <LegalDocumentView docKey={legal} onBack={() => setLegal(null)} />;
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#0b0b0f]">
      <header className="shrink-0 flex items-center gap-3 p-4 border-b border-[#1e1e2f] bg-[#12121a]">
        <button type="button" onClick={onBack} className="text-gray-400 hover:text-white text-xl">
          ←
        </button>
        <GearIcon className="w-6 h-6 text-gray-400" />
        <h1 className="text-lg font-bold text-white flex-1">Paramètres</h1>
        {saved && (
          <span className="text-[10px] text-green-400 bg-green-500/10 px-2 py-1 rounded-full">{saved}</span>
        )}
      </header>

      <div className="flex-1 overflow-y-auto pb-8">
        <section className="border-b border-[#1e1e2f]">
          <p className="px-4 pt-4 pb-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Carte</p>
          <div className="px-4 pb-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-white">Distance de recherche</span>
              <span className="text-purple-400 font-bold">{formatRadiusKm(radiusKm)}</span>
            </div>
            <input
              type="range"
              min={NEARBY_RADIUS_MIN}
              max={NEARBY_RADIUS_MAX}
              step={1}
              value={Math.min(radiusKm, NEARBY_RADIUS_MAX)}
              onChange={(e) => applyRadius(Number(e.target.value))}
              className="w-full accent-purple-500"
            />
            <div className="flex items-center gap-2 mt-2">
              <input
                type="number"
                min={NEARBY_RADIUS_MIN}
                step={1}
                value={radiusKm >= NEARBY_RADIUS_HARD_MAX ? '' : radiusKm}
                placeholder="ex : 1000"
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (e.target.value.trim() && Number.isFinite(n)) applyRadius(clampNearbyRadiusKm(n));
                }}
                onBlur={(e) => {
                  const n = Number(e.target.value);
                  if (e.target.value.trim() && Number.isFinite(n)) applyRadius(clampNearbyRadiusKm(n));
                }}
                className="w-20 px-2 py-1.5 rounded-lg bg-[#0b0b0f] border border-[#2a2a3f] text-sm text-white text-center"
                aria-label="Distance en kilomètres"
              />
              <span className="text-xs text-gray-500">km</span>
              <button
                type="button"
                onClick={() => applyRadius(NEARBY_RADIUS_HARD_MAX)}
                className={`text-xs px-2.5 py-1 rounded-lg border transition ${
                  radiusKm >= NEARBY_RADIUS_HARD_MAX
                    ? 'border-purple-500/50 bg-purple-500/15 text-purple-300'
                    : 'border-[#2d2d3d] text-gray-500 hover:text-gray-300'
                }`}
                title="Rayon illimité (20 000 km)"
              >
                Illimité
              </button>
            </div>
            <p className="text-[10px] text-gray-500 mt-2">
              Salons, lives et personnes affichés dans ce rayon. Curseur : 1–500 km. Saisie
              manuelle au-delà : tapez 1 000, 5 000 km ou cliquez « Illimité ». En msdev,
              essayez 50–100 km et choisissez une ville (Paris, Tokyo, New York…).
            </p>
          </div>
        </section>

        <section className="border-b border-[#1e1e2f]">
          <p className="px-4 pt-4 pb-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Compte</p>
          <SettingsRow label="Abonnement Soundly+" hint="Bientôt disponible">
            <span className="text-[10px] px-2 py-1 rounded-full bg-amber-500/20 text-amber-400 font-bold">
              Gratuit
            </span>
          </SettingsRow>
        </section>

        {/* ── Sécurité ── */}
        <section className="border-b border-[#1e1e2f]">
          <p className="px-4 pt-4 pb-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Sécurité</p>

          <SettingsRow
            label="Changer le mot de passe"
            hint="Mot de passe actuel requis"
            onClick={() => { setPwSection((s) => !s); setPwError(''); }}
          />

          {pwSection && (
            <form onSubmit={handleChangePassword} className="px-4 pb-4 space-y-3">
              <input
                type="password"
                placeholder="Mot de passe actuel"
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full bg-[#0b0b0f] border border-[#2d2d3d] rounded-xl px-4 py-2.5 text-sm text-white"
              />
              <div className="space-y-1.5">
                <input
                  type="password"
                  placeholder="Nouveau mot de passe"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full bg-[#0b0b0f] border border-[#2d2d3d] rounded-xl px-4 py-2.5 text-sm text-white"
                />
                <PasswordStrengthBar password={newPwd} />
              </div>
              <input
                type="password"
                placeholder="Confirmer le nouveau mot de passe"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full bg-[#0b0b0f] border border-[#2d2d3d] rounded-xl px-4 py-2.5 text-sm text-white"
              />
              {confirmPwd && newPwd !== confirmPwd && (
                <p className="text-[11px] text-red-400">Les mots de passe ne correspondent pas</p>
              )}
              {pwError && (
                <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{pwError}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setPwSection(false); setPwError(''); setCurrentPwd(''); setNewPwd(''); setConfirmPwd(''); }}
                  className="flex-1 py-2 rounded-xl text-sm text-gray-400 bg-[#1a1a26] hover:bg-[#22222f] transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={pwLoading}
                  className="flex-1 py-2 rounded-xl text-sm font-bold text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-50 transition"
                >
                  {pwLoading ? '…' : 'Enregistrer'}
                </button>
              </div>
            </form>
          )}

          <SettingsRow
            label="Supprimer mon compte"
            hint="Action irréversible"
            onClick={() => { setDeleteModal(true); setDeleteError(''); setDeletePwd(''); setDeleteConfirmText(''); }}
          >
            <span className="text-red-400/70 shrink-0">›</span>
          </SettingsRow>
        </section>

        {/* ── Modal suppression de compte ── */}
        {deleteModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <form
              onSubmit={handleDeleteAccount}
              className="w-full max-w-sm bg-[#12121a] border border-red-500/30 rounded-2xl p-6 space-y-4"
            >
              <div className="text-center space-y-1">
                <p className="text-2xl">⚠️</p>
                <h2 className="text-lg font-bold text-white">Supprimer mon compte</h2>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Cette action est <strong className="text-red-400">irréversible</strong>. Toutes vos données seront définitivement supprimées.
                </p>
              </div>
              <input
                type="password"
                placeholder="Votre mot de passe"
                value={deletePwd}
                onChange={(e) => setDeletePwd(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full bg-[#0b0b0f] border border-[#2d2d3d] rounded-xl px-4 py-2.5 text-sm text-white"
              />
              <div className="space-y-1">
                <p className="text-xs text-gray-400">
                  Tapez <span className="font-mono font-bold text-red-400">SUPPRIMER</span> pour confirmer
                </p>
                <input
                  type="text"
                  placeholder="SUPPRIMER"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  required
                  className="w-full bg-[#0b0b0f] border border-[#2d2d3d] rounded-xl px-4 py-2.5 text-sm text-white font-mono"
                />
              </div>
              {deleteError && (
                <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{deleteError}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm text-gray-400 bg-[#1a1a26] hover:bg-[#22222f] transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={deleteLoading || deleteConfirmText !== 'SUPPRIMER'}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 transition"
                >
                  {deleteLoading ? '…' : 'Supprimer'}
                </button>
              </div>
            </form>
          </div>
        )}

        <section className="border-b border-[#1e1e2f]">
          <p className="px-4 pt-4 pb-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
            Flux Reels
          </p>
          <label className="flex items-center justify-between gap-3 p-4 cursor-pointer">
            <div>
              <p className="text-sm font-semibold text-white">Algorithme Soundly</p>
            </div>
            <input
              type="checkbox"
              checked={feedAlgo.useBuiltInAlgorithm}
              onChange={(e) =>
                applyFeedAlgo({
                  ...feedAlgo,
                  useBuiltInAlgorithm: e.target.checked,
                  weights: e.target.checked
                    ? { ...BUILTIN_ALGORITHM_WEIGHTS }
                    : { ...feedAlgo.weights },
                })
              }
              className="w-5 h-5 accent-purple-500"
            />
          </label>
          {!feedAlgo.useBuiltInAlgorithm && (
            <div className="px-4 pb-4 space-y-4 border-t border-[#1e1e2f]/50">
              <p className="text-xs text-gray-400 pt-3">
                Ajustez l’importance de chaque critère (0 = ignoré, 100 = priorité max). Le flux
                se réordonne à chaque ouverture de l’onglet Reels.
              </p>
              {(
                [
                  ['likes', 'Nombre de likes', feedAlgo.weights.likes],
                  ['comments', 'Nombre de commentaires', feedAlgo.weights.comments],
                  ['views', 'Nombre de vues', feedAlgo.weights.views],
                  ['shares', 'Nombre de partages', feedAlgo.weights.shares],
                  ['recency', 'Date de mise en ligne (récent)', feedAlgo.weights.recency],
                ] as const
              ).map(([key, label, val]) => (
                <div key={key}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-white">{label}</span>
                    <span className="text-purple-400 font-bold">{val}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={val}
                    onChange={(e) => updateFeedWeight(key, Number(e.target.value))}
                    className="w-full accent-purple-500"
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  applyFeedAlgo({
                    useBuiltInAlgorithm: false,
                    weights: { ...DEFAULT_CUSTOM_WEIGHTS },
                  })
                }
                className="text-xs text-purple-400 hover:text-purple-300"
              >
                Réinitialiser les curseurs (20 % chacun)
              </button>
            </div>
          )}
        </section>

        <section className="border-b border-[#1e1e2f]">
          <p className="px-4 pt-4 pb-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
            Application
          </p>
          <SettingsRow label="Langue">
            <select
              value={language}
              onChange={(e) => applyLanguage(e.target.value as AppLanguage)}
              className="bg-[#1a1a26] border border-[#2d2d3d] rounded-lg px-2 py-1 text-sm text-white"
              onClick={(e) => e.stopPropagation()}
            >
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
          </SettingsRow>
        </section>

        <section className="border-b border-[#1e1e2f]">
          <p className="px-4 pt-4 pb-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
            Confidentialité
          </p>
          <label className="flex items-center justify-between gap-3 p-4 cursor-pointer">
            <div>
              <p className="text-sm font-semibold text-white">Messages de nouveaux contacts</p>
              <p className="text-xs text-gray-500">Autoriser les MP sans invitation préalable</p>
            </div>
            <input
              type="checkbox"
              checked={privacy.allowDmFromAnyone}
              onChange={(e) =>
                applyPrivacy({ ...privacy, allowDmFromAnyone: e.target.checked })
              }
              className="w-5 h-5 accent-purple-500"
            />
          </label>
          <p className="px-4 pb-3 text-[10px] text-gray-500">
            Visibilité sur la carte : icône œil barré en haut de l&apos;écran.
          </p>
        </section>

        <section className="border-b border-[#1e1e2f]">
          <p className="px-4 pt-4 pb-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
            {SUPPORT.title}
          </p>
          <SupportMeloSongSection onToast={flash} />
        </section>

        <section>
          <p className="px-4 pt-4 pb-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Légal</p>
          <SettingsRow label="Mentions légales" onClick={() => setLegal('mentions')} />
          <SettingsRow label={"Conditions générales d'utilisation"} onClick={() => setLegal('terms')} />
          <SettingsRow label="Politique de confidentialité (RGPD)" onClick={() => setLegal('privacy')} />
          <SettingsRow label="Conformité RGPD" onClick={() => setLegal('rgpd')} />
          <SettingsRow
            label="Spotify & YouTube (API)"
            hint="Conditions des plateformes tierces"
            onClick={() => setLegal('apiPlatforms')}
          />
          <SettingsRow label="Préférences de confidentialité" hint="Réglages dans l’app ci-dessus" />
          <SettingsRow label="Licences & crédits" onClick={() => setLegal('licenses')} />
        </section>

        {(onOpenAnalytics || onOpenAccessManagement) && (
          <section className="border-t border-[#1e1e2f] mt-4">
            <p className="px-4 pt-5 pb-1 text-[10px] font-semibold text-gray-600 uppercase tracking-wider">
              Développeur
            </p>
            {onOpenAccessManagement && (
              <SettingsRow
                label="Gestion des accès"
                hint="Approuver, suspendre, codes d’invitation (tunnel ngrok)"
                onClick={onOpenAccessManagement}
              />
            )}
            {onOpenAnalytics && (
              <SettingsRow
                label="Analytics"
                hint="Statistiques d'utilisation (msdev)"
                onClick={onOpenAnalytics}
              />
            )}
          </section>
        )}

        <p className="px-4 pt-6 text-center text-[10px] text-gray-600">Soundly · msdev · v1.0</p>
      </div>
    </div>
  );
}
