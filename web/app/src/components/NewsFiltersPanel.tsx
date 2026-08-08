import { PROFILE_TYPE_OPTIONS } from '../lib/profileTypes';
import {
  DEFAULT_NEWS_USER_PREFS,
  NEWS_CATEGORY_OPTIONS,
  readNewsUserPrefs,
  writeNewsUserPrefs,
  type NewsCategory,
  type NewsUserPrefs,
} from '../lib/feedUserPrefs';
import { viewerHasTasteProfile, type ProfileTastes } from '../lib/musicAffinities';
import type { ProfileType } from '../types';

interface NewsFiltersPanelProps {
  prefs: NewsUserPrefs;
  onPrefsChange: (prefs: NewsUserPrefs) => void;
  viewerTastes: ProfileTastes;
  /** Affiche aussi les types de profil (héritage feed) — masqué par défaut sur Actualités. */
  showProfileTypes?: boolean;
  profileTypes?: ProfileType[];
  customProfileType?: string;
  onToggleProfileType?: (profileType: ProfileType) => void;
  onCustomProfileTypeChange?: (value: string) => void;
}

function chipClass(active: boolean): string {
  return `flex items-start gap-1.5 p-2 rounded-lg border text-left transition ${
    active
      ? 'border-purple-500/50 bg-purple-500/15 text-purple-200'
      : 'border-[#2d2d3d] text-gray-500 hover:text-gray-300 hover:border-purple-500/30'
  }`;
}

export function NewsFiltersPanel({
  prefs,
  onPrefsChange,
  viewerTastes,
  showProfileTypes = false,
  profileTypes = [],
  customProfileType = '',
  onToggleProfileType,
  onCustomProfileTypeChange,
}: NewsFiltersPanelProps) {
  const updatePrefs = (patch: Partial<NewsUserPrefs>) => {
    onPrefsChange({ ...prefs, ...patch });
  };

  const toggleCategory = (category: NewsCategory) => {
    const has = prefs.categories.includes(category);
    const categories = has
      ? prefs.categories.filter((c) => c !== category)
      : [...prefs.categories, category];
    updatePrefs({ categories });
  };

  const filtersActive = prefs.categories.length > 0 || prefs.musicalAffinitiesOnly;
  const affinityNeedsProfile =
    prefs.musicalAffinitiesOnly && !viewerHasTasteProfile(viewerTastes);

  return (
    <div className="shrink-0 border-b border-[#1e1e2f] px-3 py-3 space-y-3 bg-[#12121a] max-h-[min(50vh,20rem)] overflow-y-auto">
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Actualités</p>

      <div>
        <p className="text-[10px] text-gray-400 mb-1.5">Catégories</p>
        <div className="grid grid-cols-2 gap-1.5">
          {NEWS_CATEGORY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleCategory(opt.value)}
              className={chipClass(prefs.categories.includes(opt.value))}
            >
              <span className="text-sm shrink-0 leading-none">{opt.emoji}</span>
              <span className="text-[10px] font-semibold leading-tight">{opt.label}</span>
            </button>
          ))}
        </div>
        <p className="text-[9px] text-gray-600 mt-1">Aucune sélection = toutes les catégories</p>
      </div>

      {showProfileTypes && onToggleProfileType ? (
        <div>
          <p className="text-[10px] text-gray-400 mb-1.5">Type de profil</p>
          <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-0.5">
            {PROFILE_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onToggleProfileType(opt.value)}
                className={chipClass(profileTypes.includes(opt.value))}
              >
                <span className="text-sm shrink-0 leading-none">{opt.emoji}</span>
                <span className="text-[10px] font-semibold leading-tight">{opt.label}</span>
              </button>
            ))}
          </div>
          {profileTypes.includes('autre') && onCustomProfileTypeChange ? (
            <input
              type="text"
              value={customProfileType}
              onChange={(e) => onCustomProfileTypeChange(e.target.value)}
              placeholder="Précisez votre type de profil..."
              maxLength={80}
              className="mt-2 w-full rounded-lg bg-[#0b0b0f] border border-purple-500/40 px-3 py-1.5 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
          ) : null}
          <p className="text-[9px] text-gray-600 mt-1">Aucune sélection = tous les profils</p>
        </div>
      ) : null}

      <label className="flex items-center justify-between gap-2 cursor-pointer">
        <span className="text-[10px] text-gray-300 leading-snug pr-2">
          Affinités musicales
          <span className="block text-[9px] text-gray-500 font-normal">
            Genres ou artistes en commun avec mon profil
          </span>
        </span>
        <input
          type="checkbox"
          checked={prefs.musicalAffinitiesOnly}
          onChange={(e) => updatePrefs({ musicalAffinitiesOnly: e.target.checked })}
          className="onscen-checkbox scale-90 shrink-0"
        />
      </label>

      {affinityNeedsProfile ? (
        <p className="text-[10px] text-amber-500/90">
          Complétez vos goûts musicaux dans votre profil pour utiliser ce filtre.
        </p>
      ) : null}

      {filtersActive ? (
        <button
          type="button"
          onClick={() => {
            writeNewsUserPrefs({ ...DEFAULT_NEWS_USER_PREFS });
            onPrefsChange(readNewsUserPrefs());
          }}
          className="text-[10px] font-semibold text-gray-400 hover:text-white"
        >
          Réinitialiser les filtres
        </button>
      ) : null}
    </div>
  );
}
