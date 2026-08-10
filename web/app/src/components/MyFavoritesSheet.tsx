import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { UserAvatarOnline } from './UserAvatarOnline';
import { UsernameDisplay } from './UsernameDisplay';
import { ConfirmModal } from './ConfirmModal';
import type { User } from '../types';

interface MyFavoritesSheetProps {
  token: string;
  onClose: () => void;
  onOpenProfile: (userId: string) => void;
  onFavoritesChanged?: (count: number) => void;
}

export function MyFavoritesSheet({
  token,
  onClose,
  onOpenProfile,
  onFavoritesChanged,
}: MyFavoritesSheetProps) {
  const [favorites, setFavorites] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmRemoveUser, setConfirmRemoveUser] = useState<User | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getMyFavorites(token)
      .then((r) => {
        if (!cancelled) setFavorites(r.favorites);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Impossible de charger les favoris');
          setFavorites([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const confirmRemoveFavorite = async () => {
    if (!confirmRemoveUser) return;
    const userId = confirmRemoveUser.id;
    setRemovingId(userId);
    try {
      await api.removeFavorite(token, userId);
      setFavorites((prev) => {
        const next = prev.filter((u) => u.id !== userId);
        onFavoritesChanged?.(next.length);
        return next;
      });
      setConfirmRemoveUser(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de retirer ce favori');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center ms-modal-overlay bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="my-favorites-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[min(85dvh,32rem)] flex flex-col bg-[#12121a] border border-[#2d2d3d] rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 p-4 border-b border-[#1e1e2f] flex items-center justify-between">
          <h2 id="my-favorites-title" className="font-bold text-white flex items-center gap-2">
            <span aria-hidden>⭐</span>
            Mes Favoris
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl leading-none"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-2">
          {loading ? (
            <p className="p-6 text-center text-sm text-gray-500">Chargement…</p>
          ) : error ? (
            <p className="p-6 text-center text-sm text-red-400">{error}</p>
          ) : favorites.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-500">Aucun favori pour le moment</p>
          ) : (
            <ul className="space-y-1">
              {favorites.map((user) => (
                <li
                  key={user.id}
                  className="flex items-center gap-1 rounded-xl hover:bg-[#1a1a26] transition"
                >
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenProfile(user.id);
                    }}
                    className="flex-1 min-w-0 flex items-center gap-3 px-3 py-2.5 text-left"
                  >
                    <UserAvatarOnline
                      userId={user.id}
                      username={user.username}
                      avatarUrl={user.avatarUrl}
                      size="sm"
                      isLive={user.isLive}
                      liveViewersCount={user.isLive ? user.liveViewersCount : undefined}
                    />
                    <UsernameDisplay
                      as="span"
                      username={user.username}
                      usernameColor={user.usernameColor}
                      usernameWaveFrom={user.usernameWaveFrom}
                      usernameWaveTo={user.usernameWaveTo}
                      className="text-sm font-semibold truncate"
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmRemoveUser(user)}
                    disabled={removingId === user.id}
                    className="shrink-0 p-2 mr-1 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition"
                    title="Retirer des favoris"
                    aria-label={`Retirer ${user.username} des favoris`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M3 6h18" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      <line x1="10" y1="11" x2="10" y2="17" />
                      <line x1="14" y1="11" x2="14" y2="17" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <ConfirmModal
        open={confirmRemoveUser !== null}
        title={
          confirmRemoveUser
            ? `Retirer ${confirmRemoveUser.username} de vos favoris ?`
            : 'Retirer ce favori ?'
        }
        description="Cette personne ne sera plus dans votre liste de favoris."
        confirmLabel="Retirer"
        loading={Boolean(confirmRemoveUser && removingId === confirmRemoveUser.id)}
        onCancel={() => setConfirmRemoveUser(null)}
        onConfirm={() => void confirmRemoveFavorite()}
      />
    </div>
  );
}
