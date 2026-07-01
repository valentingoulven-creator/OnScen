import type { StoryTaggedUser } from '../types';
import { UserAvatarOnline } from './UserAvatarOnline';
import { UsernameDisplay } from './UsernameDisplay';

interface EventTaggedUsersRowProps {
  taggedUsers: StoryTaggedUser[];
  onOpenUser?: (userId: string) => void;
  className?: string;
}

/** Affiche les comptes tagués sur un événement (DJ, artiste, partenaire…). */
export function EventTaggedUsersRow({
  taggedUsers,
  onOpenUser,
  className = '',
}: EventTaggedUsersRowProps) {
  if (!taggedUsers.length) return null;

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`.trim()}>
      <span className="text-[10px] font-semibold text-purple-300/90 shrink-0">Avec</span>
      {taggedUsers.map((t) => {
        const chip = (
          <>
            <UserAvatarOnline userId={t.id} username={t.username} avatarUrl={t.avatarUrl} size="sm" />
            <UsernameDisplay
              username={t.username}
              usernameColor={t.usernameColor}
              usernameWaveFrom={t.usernameWaveFrom}
              usernameWaveTo={t.usernameWaveTo}
              className="text-[10px] font-medium truncate max-w-[8rem]"
            />
          </>
        );
        const chipClass =
          'inline-flex items-center gap-1 rounded-full pl-1 pr-2.5 py-0.5 bg-purple-600/15 border border-purple-500/25 max-w-full min-w-0';
        if (onOpenUser) {
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onOpenUser(t.id)}
              className={`${chipClass} hover:border-purple-400/50 transition`}
              aria-label={`Profil de ${t.username}`}
            >
              {chip}
            </button>
          );
        }
        return (
          <span key={t.id} className={chipClass}>
            {chip}
          </span>
        );
      })}
    </div>
  );
}
