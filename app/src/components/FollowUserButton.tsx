import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

interface FollowUserButtonProps {
  userId: string;
  username?: string;
  initialFollowing?: boolean;
  compact?: boolean;
  iconOnly?: boolean;
  className?: string;
  onFollowingChange?: (following: boolean) => void;
}

export function FollowUserButton({
  userId,
  username,
  initialFollowing = false,
  compact = false,
  iconOnly = false,
  className = '',
  onFollowingChange,
}: FollowUserButtonProps) {
  const { user: me, token } = useAuth();
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmUnfollow, setConfirmUnfollow] = useState(false);

  useEffect(() => {
    setFollowing(initialFollowing);
  }, [initialFollowing]);

  if (!token || me?.id === userId) return null;

  const displayName = username?.trim() || 'cet utilisateur';

  const follow = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      await api.followUser(token, userId);
      setFollowing(true);
      onFollowingChange?.(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const unfollow = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      await api.unfollowUser(token, userId);
      setFollowing(false);
      onFollowingChange?.(false);
      setConfirmUnfollow(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading) return;
    if (following) {
      setConfirmUnfollow(true);
      return;
    }
    void follow();
  };

  const base = iconOnly
    ? 'p-1 rounded-full border transition disabled:opacity-50'
    : compact
      ? 'px-2.5 py-1 rounded-full text-[10px] font-bold border transition disabled:opacity-50'
      : 'w-full py-2.5 rounded-xl text-sm font-bold border transition disabled:opacity-50';

  const label = loading ? '…' : following ? 'Ne plus suivre' : 'Suivre';

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        title={label}
        aria-label={label}
        className={`${base} ${
          following
            ? 'bg-[#1a1a26]/90 border-[#2d2d3d] text-gray-300 hover:border-gray-500'
            : 'bg-purple-600/80 border-purple-500/50 text-white hover:bg-purple-600'
        }`}
      >
        {iconOnly ? (
          loading ? (
            <span className="block w-3.5 h-3.5 text-[10px] leading-[14px] text-center">…</span>
          ) : following ? (
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
            </svg>
          )
        ) : (
          label
        )}
      </button>
      {error && <p className="text-[10px] text-red-400 mt-1 text-center">{error}</p>}

      {confirmUnfollow && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="unfollow-confirm-title"
          onClick={(e) => {
            e.stopPropagation();
            if (!loading) setConfirmUnfollow(false);
          }}
        >
          <div
            className="w-full max-w-sm bg-[#12121a] border border-[#2d2d3d] rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5">
              <p id="unfollow-confirm-title" className="text-lg font-bold text-white">
                Ne plus suivre {displayName} ?
              </p>
              <p className="text-sm text-gray-400 mt-2 leading-relaxed">
                Vous ne verrez plus ses lives et mises à jour dans votre fil de suivis.
              </p>
            </div>
            <div className="flex gap-2 p-4 border-t border-[#1e1e2f] bg-[#0b0b0f]/50">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!loading) setConfirmUnfollow(false);
                }}
                disabled={loading}
                className="flex-1 py-3 rounded-xl border border-[#2d2d3d] text-gray-300 text-sm font-semibold hover:text-white disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void unfollow();
                }}
                disabled={loading}
                className="flex-1 py-3 rounded-xl bg-[#2d2d3d] hover:bg-[#3d3d4d] text-white text-sm font-bold disabled:opacity-50"
              >
                {loading ? '…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
