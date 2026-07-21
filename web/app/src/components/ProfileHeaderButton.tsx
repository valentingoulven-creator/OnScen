import { useTranslation } from 'react-i18next';
import { UserAvatarOnline } from './UserAvatarOnline';

interface ProfileHeaderButtonProps {
  userId: string;
  username: string;
  avatarUrl?: string;
  onClick: () => void;
  active?: boolean;
}

export function ProfileHeaderButton({
  userId,
  username,
  avatarUrl,
  onClick,
  active = false,
}: ProfileHeaderButtonProps) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={onClick}
      title={t('profile.openOwnProfile', { defaultValue: 'Mon profil' })}
      aria-label={t('profile.openOwnProfileAria', {
        defaultValue: 'Ouvrir mon profil',
      })}
      aria-current={active ? 'page' : undefined}
      className={`group flex items-center justify-center shrink-0 rounded-full border transition-colors min-h-11 min-w-11 w-11 h-11 cursor-pointer p-0.5 ${
        active
          ? 'border-purple-500/50 bg-purple-500/10 ring-1 ring-purple-500/30'
          : 'border-[#2d2d3d] bg-[#1a1a26] hover:border-purple-500/35 hover:bg-[#1e1e2a]'
      }`}
    >
      <span
        className={`rounded-full shrink-0 ${
          active ? 'ring-2 ring-purple-400/60' : 'ring-1 ring-white/10 group-hover:ring-purple-400/40'
        }`}
      >
        <UserAvatarOnline
          userId={userId}
          username={username}
          avatarUrl={avatarUrl}
          size="xs"
        />
      </span>
    </button>
  );
}
