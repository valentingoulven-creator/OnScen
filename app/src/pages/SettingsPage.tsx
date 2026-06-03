import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { LEGAL, type LegalKey } from '../content/legal';
import { SUPPORT } from '../content/support';
import { SupportMeloSongSection } from '../components/SupportMeloSongSection';
import {
  getNearbyRadiusKm,
  setNearbyRadiusKm,
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


interface SettingsPageProps {
  onBack: () => void;
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

export function SettingsPage({ onBack }: SettingsPageProps) {
  const { user, token, refreshUser } = useAuth();
  const [radiusKm, setRadiusKm] = useState(getNearbyRadiusKm);
  const [language, setLanguage] = useState<AppLanguage>(getAppLanguage);
  const [privacy, setPrivacy] = useState<PrivacyPreferences>(getPrivacyPreferences);
  const [ghost, setGhost] = useState(user?.isGhostMode ?? false);
  const [legal, setLegal] = useState<LegalKey | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [feedAlgo, setFeedAlgo] = useState<ReelFeedAlgorithmPreferences>(getFeedAlgorithmPreferences);

  useEffect(() => {
    if (!user) return;
    setGhost(user.isGhostMode ?? false);
    const local = getPrivacyPreferences();
    setPrivacy({
      ...local,
      showOnNearbyList: !user.isGhostMode,
    });
  }, [user?.id, user?.isGhostMode]);

  const flash = (msg: string) => {
    setSaved(msg);
    setTimeout(() => setSaved(null), 2000);
  };

  const applyRadius = (v: number) => {
    setRadiusKm(v);
    setNearbyRadiusKm(v);
    flash('Distance mise à jour');
  };

  const applyLanguage = (lang: AppLanguage) => {
    setLanguage(lang);
    setAppLanguage(lang);
    flash(lang === 'fr' ? 'Langue : français' : 'Language: English');
  };

  const applyPrivacy = async (next: PrivacyPreferences) => {
    setPrivacy(next);
    setPrivacyPreferences(next);
    const wantOnMap = next.showOnNearbyList;
    const ghostNow = user?.isGhostMode ?? false;
    if (token && wantOnMap === ghostNow) {
      try {
        await api.toggleGhost(token, !wantOnMap);
        setGhost(!wantOnMap);
        await refreshUser();
        flash(wantOnMap ? 'Visible sur la carte' : 'Masqué de la carte');
        return;
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Erreur');
      }
    }
    flash('Préférences enregistrées');
  };

  const applyFeedAlgo = (next: ReelFeedAlgorithmPreferences) => {
    setFeedAlgo(next);
    setFeedAlgorithmPreferences(next);
    notifyFeedAlgorithmChanged();
    flash(
      next.useBuiltInAlgorithm
        ? 'Algorithme MeloSong activé'
        : 'Tri personnalisé des Reels activé'
    );
  };

  const updateFeedWeight = (key: keyof ReelFeedAlgorithmWeights, value: number) => {
    applyFeedAlgo({
      ...feedAlgo,
      weights: { ...feedAlgo.weights, [key]: value },
    });
  };

  const toggleGhost = async () => {
    if (!token) return;
    const next = !ghost;
    await api.toggleGhost(token, next);
    setGhost(next);
    await refreshUser();
    flash(next ? 'Mode fantôme activé' : 'Mode fantôme désactivé');
  };

  if (legal) {
    const doc = LEGAL[legal];
    return (
      <div className="flex flex-col h-full min-h-0 bg-[#0b0b0f]">
        <header className="shrink-0 flex items-center gap-3 p-4 border-b border-[#1e1e2f]">
          <button type="button" onClick={() => setLegal(null)} className="text-gray-400 hover:text-white text-xl">
            ←
          </button>
          <h1 className="font-bold text-white text-sm">{doc.title}</h1>
        </header>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <p className="text-xs text-gray-500">Mis à jour : {doc.updated}</p>
          {doc.sections.map((s) => (
            <section key={s.heading} className="bg-[#12121a] border border-[#1e1e2f] rounded-xl p-4">
              <h2 className="text-sm font-bold text-purple-400 mb-2">{s.heading}</h2>
              <div className="text-sm text-gray-300 leading-relaxed space-y-2">
                {s.body.split('\n\n').map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    );
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
              <span className="text-purple-400 font-bold">{radiusKm} km</span>
            </div>
            <input
              type="range"
              min={5}
              max={50}
              step={1}
              value={radiusKm}
              onChange={(e) => applyRadius(Number(e.target.value))}
              className="w-full accent-purple-500"
            />
            <p className="text-[10px] text-gray-500 mt-2">
              Salons, lives et personnes affichés dans ce rayon autour de vous
            </p>
          </div>
        </section>

        <section className="border-b border-[#1e1e2f]">
          <p className="px-4 pt-4 pb-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Compte</p>
          <SettingsRow label="Abonnement MeloSong+" hint="Bientôt disponible">
            <span className="text-[10px] px-2 py-1 rounded-full bg-amber-500/20 text-amber-400 font-bold">
              Gratuit
            </span>
          </SettingsRow>
        </section>

        <section className="border-b border-[#1e1e2f]">
          <p className="px-4 pt-4 pb-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
            Flux Reels
          </p>
          <label className="flex items-center justify-between gap-3 p-4 cursor-pointer">
            <div>
              <p className="text-sm font-semibold text-white">Algorithme MeloSong</p>
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
              <p className="text-sm font-semibold text-white">Apparaître dans « À proximité »</p>
              <p className="text-xs text-gray-500">Les autres peuvent vous voir sur la carte</p>
            </div>
            <input
              type="checkbox"
              checked={privacy.showOnNearbyList}
              onChange={(e) =>
                applyPrivacy({ ...privacy, showOnNearbyList: e.target.checked })
              }
              className="w-5 h-5 accent-purple-500"
            />
          </label>
          <label className="flex items-center justify-between gap-3 p-4 cursor-pointer border-t border-[#1e1e2f]/50">
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
          <SettingsRow label="Mode fantôme" hint="Masquer votre activité sur la carte">
            <button
              type="button"
              onClick={toggleGhost}
              className={`px-3 py-1 rounded-full text-xs font-bold ${
                ghost ? 'bg-purple-600 text-white' : 'bg-[#1a1a26] text-gray-400 border border-[#2d2d3d]'
              }`}
            >
              {ghost ? 'ON' : 'OFF'}
            </button>
          </SettingsRow>
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

        <p className="px-4 pt-6 text-center text-[10px] text-gray-600">MeloSong · msdev · v1.0</p>
      </div>
    </div>
  );
}
