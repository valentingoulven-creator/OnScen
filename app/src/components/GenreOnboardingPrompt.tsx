import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

const GENRE_PROMPT_DONE_KEY = 'soundy_genre_prompt_done';

const ALL_GENRES = [
  'Électro', 'House', 'Techno', 'French touch', 'Ambient',
  'Jazz', 'Soul', 'Blues', 'Funk', 'Gospel',
  'Rock', 'Metal', 'Punk', 'Indie', 'Folk',
  'Hip-hop', 'Rap', 'R&B', 'Trap', 'Drill',
  'Pop', 'K-pop', 'Latin', 'Reggae', 'Afrobeats',
  'Classique', 'Lo-fi', 'Country',
];

export function shouldShowGenrePrompt(favoriteGenres: string[] | undefined): boolean {
  try {
    if (localStorage.getItem(GENRE_PROMPT_DONE_KEY) === '1') return false;
  } catch {
    return false;
  }
  return !favoriteGenres || favoriteGenres.length === 0;
}

export function dismissGenrePrompt(): void {
  try {
    localStorage.setItem(GENRE_PROMPT_DONE_KEY, '1');
  } catch {
    /* ignore */
  }
}

interface Props {
  onDismiss: () => void;
}

export function GenreOnboardingPrompt({ onDismiss }: Props) {
  const { user, token, setUserFromProfile } = useAuth();
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggle = (g: string) => {
    setSelected((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : prev.length < 10 ? [...prev, g] : prev
    );
  };

  const handleSave = async () => {
    if (selected.length < 3) {
      setError('Sélectionne au moins 3 genres pour continuer.');
      return;
    }
    if (!token) return;
    setSaving(true);
    setError('');
    try {
      const { user: updated } = await api.updateProfile(token, { favoriteGenres: selected });
      setUserFromProfile(updated);
      dismissGenrePrompt();
      onDismiss();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    dismissGenrePrompt();
    onDismiss();
  };

  if (!user) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-4 pb-4 sm:pb-0">
      <div className="w-full max-w-sm bg-[#12121a] border border-[#2d2d3d] rounded-2xl p-5 space-y-4 shadow-2xl">
        <div className="text-center space-y-1">
          <div className="inline-flex w-11 h-11 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 items-center justify-center text-xl mb-1">
            🎵
          </div>
          <h2 className="text-base font-extrabold text-white">Tes genres musicaux</h2>
          <p className="text-xs text-gray-400">
            Sélectionne au moins 3 genres pour personnaliser ton fil Actualités
          </p>
        </div>

        <div className="flex flex-wrap gap-2 max-h-52 overflow-y-auto">
          {ALL_GENRES.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => toggle(g)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                selected.includes(g)
                  ? 'bg-purple-600 text-white'
                  : 'bg-[#1a1a26] text-gray-400 border border-[#2d2d3d] hover:border-purple-500/50'
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <p className={`text-xs ${selected.length >= 3 ? 'text-purple-400' : 'text-gray-500'}`}>
            {selected.length}/3 minimum sélectionné{selected.length > 1 ? 's' : ''}
          </p>
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => setSelected([])}
              className="text-[11px] text-gray-600 hover:text-gray-400"
            >
              Effacer
            </button>
          )}
        </div>

        {error && <p className="text-xs text-red-400 text-center">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={handleSkip}
            className="text-xs text-gray-500 hover:text-gray-300 px-3 py-2 flex-shrink-0"
          >
            Passer
          </button>
          <button
            type="button"
            disabled={saving || selected.length < 3}
            onClick={() => void handleSave()}
            className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-50 transition"
          >
            {saving ? '…' : 'Commencer →'}
          </button>
        </div>
      </div>
    </div>
  );
}
