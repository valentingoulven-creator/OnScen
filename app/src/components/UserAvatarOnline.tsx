interface UserAvatarOnlineProps {
  userId: string;
  avatarUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  isOnline?: boolean;
  className?: string;
}

const SIZES = {
  sm: 'w-10 h-10',
  md: 'w-11 h-11',
  lg: 'w-12 h-12',
};

const DOT = {
  sm: 'w-2.5 h-2.5 border',
  md: 'w-3 h-3 border-2',
  lg: 'w-3.5 h-3.5 border-2',
};

export function UserAvatarOnline({
  userId,
  avatarUrl,
  size = 'md',
  isOnline,
  className = '',
}: UserAvatarOnlineProps) {
  return (
    <div className={`relative shrink-0 ${className}`}>
      <img
        src={avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${userId}`}
        alt=""
        className={`${SIZES[size]} rounded-full object-cover bg-[#1a1a26]`}
      />
      {isOnline && (
        <span
          className={`absolute bottom-0 right-0 ${DOT[size]} rounded-full bg-green-500 border-[#12121a]`}
          title="En ligne"
          aria-label="En ligne"
        />
      )}
    </div>
  );
}
