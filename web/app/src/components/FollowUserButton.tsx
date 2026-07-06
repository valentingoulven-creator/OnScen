import { memo, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

interface FollowUserButtonProps {
  userId: string;
  username?: string;
  initialFollowing?: boolean;
  compact?: boolean;
  iconOnly?: boolean;
  /** Icône en mode iconOnly : plus (défaut) ou cœur (suivre). */
  iconStyle?: 'plus' | 'heart';
  /** 'pill' renders a larger rounded-full gradient button for profile pages */
  variant?: 'default' | 'pill';
  className?: string;
  onFollowingChange?: (following: boolean) => void;
}

export const FollowUserButton = memo(function FollowUserButton({
  userId,
  username,
  initialFollowing = false,
  compact = false,
  iconOnly = false,
  iconStyle = 'plus',
  variant = 'default',
  className = '',
  onFollowingChange,
}: FollowUserButtonProps) {
  const { user: me, token } = useAuth();
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmUnfollow, setConfirmUnfollow] = useState(false);
  const [followToast, setFollowToast] = useState<string | null>(null);

  useEffect(() => {
    setFollowing(initialFollowing);
  }, [initialFollowing]);

  if (!token || me?.id === userId) return null;

  const displayName = username?.trim() || 'cet utilisateur';

  const follow = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    setFollowing(true);
    onFollowingChange?.(true);
    setFollowToast(`Vous suivez maintenant ${displayName}`);
    window.setTimeout(() => setFollowToast(null), 3000);
    try {
      await api.followUser(token, userId);
    } catch (e) {
      setFollowing(false);
      onFollowingChange?.(false);
      setFollowToast(null);
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const unfollow = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    setFollowing(false);
    onFollowingChange?.(false);
    setConfirmUnfollow(false);
    try {
      await api.unfollowUser(token, userId);
    } catch (e) {
      setFollowing(true);
      onFollowingChange?.(true);
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

  const useHeart = iconStyle === 'heart';
  const heartOnly = iconOnly && useHeart;
  const compactHeart = compact && useHeart;

  const base = heartOnly
    ? 'w-11 h-11 flex items-center justify-center rounded-full border transition disabled:opacity-50'
    : compactHeart
      ? 'flex items-center justify-center gap-1.5 min-h-11 px-3 py-1.5 rounded-full text-[10px] font-bold border transition disabled:opacity-50 shrink-0'
      : iconOnly
        ? 'p-1 rounded-full border transition disabled:opacity-50'
        : variant === 'pill'
          ? 'px-5 py-2 rounded-full text-sm font-bold transition disabled:opacity-50 active:scale-[0.97]'
          : compact
            ? 'px-2.5 py-1 rounded-full text-[10px] font-bold border transition disabled:opacity-50'
            : 'w-full py-2.5 rounded-xl text-sm font-bold border transition disabled:opacity-50';

  const label = loading ? '…' : following ? 'Suivi' : 'Suivre';

  const heartSvg = (
    <svg
      viewBox="0 0 24 24"
      className={compactHeart ? 'w-4 h-4 shrink-0' : 'w-4 h-4'}
      fill={following ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
      />
    </svg>
  );

  const pillColors = variant === 'pill'
    ? following
      ? 'bg-[#1e1e2f] border border-[#2d2d3d] text-gray-300 hover:border-gray-500'
      : 'bg-gradient-to-r from-purple-600 to-pink-500 text-white shadow-lg shadow-purple-900/30 hover:from-purple-500 hover:to-pink-400'
    : following
      ? 'bg-[#1a1a26]/90 border-[#2d2d3d] text-gray-300 hover:border-gray-500'
      : 'bg-purple-600/80 border-purple-500/50 text-white hover:bg-purple-600';

  const heartColors = following
    ? 'border-red-500/50 text-red-500 bg-red-950/30 hover:border-red-400'
    : 'border-[#3d3d4d]/80 text-gray-400 hover:border-red-500/40 hover:text-red-300 bg-transparent';

  const iconColors =
    (iconOnly || compactHeart) && useHeart
      ? heartColors
      : pillColors;

  const buttonColors = iconOnly || compactHeart ? iconColors : pillColors;

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        title={label}
        aria-label={label}
        className={`${base} ${buttonColors}`}
      >
        {heartOnly || compactHeart ? (
          loading ? (
            <span className="text-[10px] leading-none">…</span>
          ) : (
            <>
              {heartSvg}
              {compactHeart ? (
                <span className="hidden sm:inline">{following ? 'Suivi' : 'Suivre'}</span>
              ) : null}
            </>
          )
        ) : iconOnly ? (
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
      {followToast && (
        <p className="text-[10px] text-purple-300 mt-1 text-center">{followToast}</p>
      )}

      {confirmUnfollow && (
        <div
          className="fixed inset-0 z-[100001] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
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
});
