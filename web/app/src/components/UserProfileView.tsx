import { useTranslation } from 'react-i18next';
import type { MatchStatus, MusicMatch, NearbyPerson, User } from '../types';

interface UserProfileViewProps {
  profile: User | null;
  preview?: NearbyPerson;
  displayName: string;
  isSelf: boolean;
  isMatched: boolean;
  justMatched: MusicMatch | null;
  matchStatus: MatchStatus | null;
  heartSent: boolean;
  heartToast: boolean;
  heartAllowed: boolean;
  heartBlockReason: string | null;
  profileIsSingle: boolean;
  profileMeetsAge: boolean;
  sending: boolean;
  error: string | null;
  onOpenLive?: (liveId: string) => void;
  onOpenSalon?: (salonId: string, salonTitle?: string, isHost?: boolean) => void;
  onSendHeart: () => void;
  meConnectedPlatforms?: User['connectedPlatforms'];
}

export function UserProfileView({
  profile,
  preview,
  displayName,
  isSelf,
  isMatched,
  justMatched,
  matchStatus,
  heartSent,
  heartToast,
  heartAllowed,
  heartBlockReason,
  profileIsSingle,
  profileMeetsAge,
  sending,
  error,
  onSendHeart,
}: UserProfileViewProps) {
  const { t } = useTranslation();

  const memberDate = profile?.memberSince
    ? new Date(profile.memberSince).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    : null;

  const showHeartButton = !isSelf && !isMatched && profileIsSingle && profileMeetsAge;

  const heartHint = () => {
    if (isMatched) return null;
    if (matchStatus?.theySentHeart && !heartSent) {
      return (
        <p className="text-xs text-pink-300 bg-pink-950/30 border border-pink-500/30 rounded-xl px-3 py-2">
          Cette personne vous a envoyé un ♥ — renvoyez un cœur pour créer un match !
        </p>
      );
    }
    if (heartSent && !justMatched) {
      return (
        <p className="text-xs text-gray-500">
          Cœur envoyé. Vous serez notifiés en cas de match musical.
        </p>
      );
    }
    return null;
  };

  return (
    <div className="space-y-5">
      {(isMatched || justMatched) && (
        <div className="text-center p-4 rounded-2xl bg-gradient-to-br from-pink-900/50 to-purple-900/40 border border-pink-500/40">
          <p className="text-3xl mb-1">💞</p>
          <p className="text-lg font-bold text-white">Match musical !</p>
          <p className="text-sm text-pink-200 mt-1">
            Vous et {displayName} partagez les mêmes vibes
          </p>
        </div>
      )}

      {preview && !profile?.city?.trim() ? (
        <p className="text-[11px] text-center text-purple-300/80">
          {preview.distanceKm != null
            ? `📡 ${preview.distanceKm} km · proche`
            : '📡 À proximité'}
        </p>
      ) : null}

      {memberDate ? (
        <p className="text-[10px] text-gray-600 text-center py-2">
          {t('profile.memberSince', { date: memberDate })}
        </p>
      ) : null}

      {heartHint()}

      {heartToast && (
        <p className="text-sm font-semibold text-pink-200 bg-pink-950/40 border border-pink-500/40 rounded-xl px-3 py-2.5">
          Cœur envoyé ! 💜
        </p>
      )}

      {showHeartButton && (
        <button
          type="button"
          onClick={onSendHeart}
          disabled={sending || heartSent || !heartAllowed}
          title={!heartAllowed && !heartSent ? (heartBlockReason ?? undefined) : undefined}
          className={`w-full py-3 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition ${
            heartSent
              ? 'bg-pink-900/40 border border-pink-500/40 text-pink-200'
              : matchStatus?.theySentHeart
                ? 'bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 shadow-lg shadow-pink-900/40 animate-pulse'
                : 'bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 shadow-lg shadow-pink-900/30'
          } disabled:opacity-60 active:scale-[0.98]`}
        >
          <span className="text-lg">{heartSent ? '💗' : '♥'}</span>
          <span className="text-sm font-bold">
            {heartSent
              ? 'Cœur envoyé'
              : sending
                ? 'Envoi...'
                : matchStatus?.theySentHeart
                  ? 'Match !'
                  : 'Cœur'}
          </span>
        </button>
      )}

      {error && profile && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
