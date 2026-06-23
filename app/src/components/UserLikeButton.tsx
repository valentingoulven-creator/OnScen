import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { formatCompactCount } from '../lib/formatCount';
import { ConfirmModal } from './ConfirmModal';

export interface UserLikeButtonProps {
  userId: string;
  username?: string;
  initialLiked?: boolean;
  initialCount?: number;
  compact?: boolean;
  iconOnly?: boolean;
  /** Affiche le nombre de likes à côté du cœur. */
  showCount?: boolean;
  className?: string;
  onLikeChange?: (liked: boolean, count: number) => void;
}

export const UserLikeButton = memo(function UserLikeButton({
  userId,
  username,
  initialLiked,
  initialCount = 0,
  compact = false,
  iconOnly = false,
  showCount = false,
  className = '',
  onLikeChange,
}: UserLikeButtonProps) {
  const { t } = useTranslation();
  const { user: me, token } = useAuth();
  const [liked, setLiked] = useState(initialLiked ?? false);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);
  const [confirmUnlike, setConfirmUnlike] = useState(false);

  useEffect(() => {
    if (initialLiked != null) setLiked(initialLiked);
  }, [initialLiked]);

  useEffect(() => {
    if (initialCount != null) setCount(initialCount);
  }, [initialCount]);

  useEffect(() => {
    if (!token || initialLiked != null || me?.id === userId) return;
    let cancelled = false;
    void api.getFavoriteStatus(token, userId).then((r) => {
      if (!cancelled) setLiked(r.isFavorite);
    });
    return () => {
      cancelled = true;
    };
  }, [token, userId, initialLiked, me?.id]);

  if (!token || me?.id === userId) {
    if (showCount && count > 0) {
      return (
        <span className={`inline-flex items-center gap-0.5 text-[10px] text-pink-300/90 tabular-nums ${className}`}>
          <span aria-hidden>♥</span>
          {formatCompactCount(count)}
        </span>
      );
    }
    return null;
  }

  const displayName = username?.trim() || t('profile.likeUserFallback');

  const applyLike = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await api.addFavorite(token, userId);
      setLiked(true);
      setCount((c) => {
        const next = c + 1;
        onLikeChange?.(true, next);
        return next;
      });
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  const applyUnlike = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await api.removeFavorite(token, userId);
      setLiked(false);
      setConfirmUnlike(false);
      setCount((c) => {
        const next = Math.max(0, c - 1);
        onLikeChange?.(false, next);
        return next;
      });
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading) return;
    if (liked) {
      setConfirmUnlike(true);
      return;
    }
    void applyLike();
  };

  const heartSize = iconOnly ? 'w-3.5 h-3.5' : compact ? 'w-4 h-4' : 'w-5 h-5';
  const label = liked ? t('profile.unlikeUser') : t('profile.likeUser');

  return (
    <>
      <div className={`inline-flex items-center gap-1 ${className}`}>
        <button
          type="button"
          onClick={handleClick}
          disabled={loading}
          title={label}
          aria-label={label}
          aria-pressed={liked}
          className={`inline-flex items-center justify-center transition disabled:opacity-50 ${
            iconOnly
              ? `p-1 rounded-full border ${
                  liked
                    ? 'border-pink-500/60 text-pink-400 bg-pink-950/40 hover:border-pink-400'
                    : 'border-[#3d3d4d]/80 text-gray-400 hover:border-pink-500/50 hover:text-pink-300 bg-transparent'
                }`
              : compact
                ? `px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                    liked
                      ? 'bg-pink-950/40 border-pink-500/50 text-pink-300'
                      : 'bg-[#1a1a26]/90 border-[#2d2d3d] text-gray-300 hover:border-pink-500/40 hover:text-pink-300'
                  }`
                : `px-4 py-2 rounded-full text-sm font-bold border ${
                    liked
                      ? 'bg-pink-950/40 border-pink-500/50 text-pink-300'
                      : 'bg-gradient-to-r from-pink-600/90 to-rose-500/90 border-pink-500/40 text-white hover:from-pink-500 hover:to-rose-400'
                  }`
          }`}
        >
          {iconOnly || compact ? (
            <svg
              viewBox="0 0 24 24"
              className={heartSize}
              fill={liked ? 'currentColor' : 'none'}
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
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <svg
                viewBox="0 0 24 24"
                className={heartSize}
                fill={liked ? 'currentColor' : 'none'}
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
              {label}
            </span>
          )}
        </button>
        {showCount && (
          <span className="text-[10px] font-semibold text-pink-300/90 tabular-nums leading-none">
            {formatCompactCount(count)}
          </span>
        )}
      </div>

      <ConfirmModal
        open={confirmUnlike}
        title={t('profile.unlikeConfirmTitle', { name: displayName })}
        description={t('profile.unlikeConfirmDescription')}
        confirmLabel={t('profile.unlikeUser')}
        onCancel={() => setConfirmUnlike(false)}
        onConfirm={() => void applyUnlike()}
      />
    </>
  );
});
