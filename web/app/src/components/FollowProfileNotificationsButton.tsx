import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

interface FollowProfileNotificationsButtonProps {
  userId: string;
  isFollowing: boolean;
  initialEnabled?: boolean;
  className?: string;
  onEnabledChange?: (enabled: boolean) => void;
}

export const FollowProfileNotificationsButton = memo(function FollowProfileNotificationsButton({
  userId,
  isFollowing,
  initialEnabled = true,
  className = '',
  onEnabledChange,
}: FollowProfileNotificationsButtonProps) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setEnabled(initialEnabled);
  }, [initialEnabled, userId]);

  const toggle = useCallback(async () => {
    if (!token || !isFollowing || loading) return;
    const next = !enabled;
    setLoading(true);
    setEnabled(next);
    onEnabledChange?.(next);
    try {
      await api.setFollowNotifications(token, userId, next);
    } catch {
      setEnabled(!next);
      onEnabledChange?.(!next);
    } finally {
      setLoading(false);
    }
  }, [token, isFollowing, loading, enabled, userId, onEnabledChange]);

  if (!token || !isFollowing) return null;

  const label = enabled
    ? t('profile.followNotificationsOn')
    : t('profile.followNotificationsOff');

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={loading}
      title={label}
      aria-label={label}
      aria-pressed={enabled}
      className={`w-11 h-11 flex items-center justify-center rounded-full border transition shrink-0 disabled:opacity-50 ${
        enabled
          ? 'border-purple-500/50 text-purple-300 bg-purple-950/40 hover:border-purple-400'
          : 'border-[#3d3d4d]/80 text-gray-500 bg-black/30 hover:border-gray-500 hover:text-gray-300'
      } ${className}`}
    >
      {loading ? (
        <span className="text-[10px]">…</span>
      ) : (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          {enabled ? (
            <>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </>
          ) : (
            <>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5"
              />
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
            </>
          )}
        </svg>
      )}
    </button>
  );
});
