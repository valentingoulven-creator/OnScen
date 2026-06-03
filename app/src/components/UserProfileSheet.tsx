import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { HostRatingBlock } from '../components/HostRatingBlock';
import { FollowUserButton } from './FollowUserButton';
import { UserReelsSection } from './UserReelsSection';
import type { MatchStatus, MusicMatch, NearbyPerson, User } from '../types';

const ROLE_LABELS: Record<string, string> = {
  auditeur: 'Auditeur',
  host: 'Host / DJ',
  les_deux: 'Auditeur & Host',
};

interface UserProfileSheetProps {
  userId: string;
  preview?: NearbyPerson;
  onClose: () => void;
  onSelectSalon?: (salonId: string) => void;
  onOpenReel?: (reelId: string) => void;
}

export function UserProfileSheet({
  userId,
  preview,
  onClose,
  onSelectSalon,
  onOpenReel,
}: UserProfileSheetProps) {
  const { user: me, token } = useAuth();
  const [profile, setProfile] = useState<User | null>(null);
  const [matchStatus, setMatchStatus] = useState<MatchStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [heartSent, setHeartSent] = useState(false);
  const [justMatched, setJustMatched] = useState<MusicMatch | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isSelf = me?.id === userId;
  const isMatched = Boolean(matchStatus?.matched || justMatched);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    Promise.all([
      api.getUserProfile(token, userId),
      api.getMatchStatus(token, userId),
    ])
      .then(([profileRes, statusRes]) => {
        setProfile(profileRes.user);
        setMatchStatus(statusRes);
        setHeartSent(statusRes.iSentHeart);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Profil introuvable'))
      .finally(() => setLoading(false));
  }, [token, userId]);

  const photos =
    profile?.profilePhotos?.length
      ? profile.profilePhotos
      : profile?.avatarUrl
        ? [profile.avatarUrl]
        : preview?.avatarUrl
          ? [preview.avatarUrl]
          : [];

  const sendHeart = async () => {
    if (!token || isSelf || sending || heartSent || isMatched) return;
    setSending(true);
    setError(null);
    try {
      const r = await api.sendHeart(token, userId);
      setHeartSent(true);
      if (r.matched && r.match) {
        setJustMatched(r.match);
        setMatchStatus((s) =>
          s ? { ...s, matched: true, match: r.match, iSentHeart: true } : null
        );
      } else {
        setMatchStatus((s) => (s ? { ...s, iSentHeart: true } : null));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setSending(false);
    }
  };

  const displayName = profile?.username ?? preview?.username ?? 'Utilisateur';

  const heartHint = () => {
    if (isMatched) return null;
    if (matchStatus?.theySentHeart && !heartSent) {
      return (
        <p className="text-xs text-center text-pink-300 bg-pink-950/30 border border-pink-500/30 rounded-xl px-3 py-2">
          Cette personne vous a envoyé un ♥ — renvoyez un cœur pour créer un match !
        </p>
      );
    }
    if (heartSent && !justMatched) {
      return (
        <p className="text-xs text-center text-gray-500">
          Cœur envoyé. Vous serez notifiés en cas de match musical.
        </p>
      );
    }
    return null;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-profile-title"
    >
      <div className="w-full max-w-md max-h-[90dvh] overflow-y-auto bg-[#12121a] border border-[#2d2d3d] rounded-t-2xl sm:rounded-2xl shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-[#1e1e2f] bg-[#12121a]">
          <h2 id="user-profile-title" className="font-bold text-white">
            Profil
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#1a1a26] text-gray-400 hover:text-white"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        {loading && (
          <p className="p-8 text-center text-gray-500 text-sm">Chargement du profil...</p>
        )}

        {!loading && error && !profile && (
          <p className="p-8 text-center text-red-400 text-sm">{error}</p>
        )}

        {!loading && (profile || preview) && (
          <div className="p-4 space-y-4">
            {(isMatched || justMatched) && (
              <div className="text-center p-4 rounded-xl bg-gradient-to-br from-pink-900/50 to-purple-900/40 border border-pink-500/40">
                <p className="text-3xl mb-1">💞</p>
                <p className="text-lg font-bold text-white">Match musical !</p>
                <p className="text-sm text-pink-200 mt-1">
                  Vous et {displayName} partagez les mêmes vibes
                </p>
              </div>
            )}

            <div className="flex items-center gap-4">
              <img
                src={photos[0] || `https://api.dicebear.com/7.x/adventurer/svg?seed=${userId}`}
                alt=""
                className="w-20 h-20 rounded-2xl object-cover border-2 border-purple-500/50"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xl font-bold text-white truncate">{displayName}</p>
                {profile?.listeningRole && (
                  <p className="text-sm text-purple-300">
                    {ROLE_LABELS[profile.listeningRole] ?? profile.listeningRole}
                  </p>
                )}
                {profile?.city && <p className="text-xs text-gray-400 mt-0.5">📍 {profile.city}</p>}
                {preview && (
                  <p className="text-xs text-gray-500 mt-1">
                    {preview.distanceKm != null
                      ? `${preview.distanceKm} km · à proximité`
                      : preview.city
                        ? `${preview.city} · à proximité`
                        : 'À proximité'}
                  </p>
                )}
              </div>
            </div>

            {profile?.bio && (
              <p className="text-sm text-gray-300 leading-relaxed">{profile.bio}</p>
            )}

            {profile?.interests && profile.interests.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {profile.interests.map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] px-2 py-1 rounded-full bg-purple-900/30 text-purple-300 border border-purple-500/20"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {profile && (profile.stats?.salonsHosted ?? 0) > 0 && (
              <HostRatingBlock hostId={userId} hostName={displayName} compact />
            )}

            {onOpenReel && (
              <UserReelsSection
                userId={userId}
                title="Reels publiés"
                onOpenReel={(reelId) => {
                  onOpenReel(reelId);
                  onClose();
                }}
              />
            )}

            {heartHint()}

            {!isSelf && (
              <FollowUserButton
                userId={userId}
                username={displayName}
                initialFollowing={profile?.isFollowing}
              />
            )}

            {!isSelf && !isMatched && (
              <button
                type="button"
                onClick={sendHeart}
                disabled={sending || heartSent}
                className={`w-full py-3.5 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition ${
                  heartSent
                    ? 'bg-pink-900/40 border border-pink-500/40 text-pink-200'
                    : matchStatus?.theySentHeart
                      ? 'bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 shadow-lg shadow-pink-900/40 animate-pulse'
                      : 'bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 shadow-lg shadow-pink-900/30'
                } disabled:opacity-60`}
              >
                <span className="text-xl">{heartSent ? '💗' : '♥'}</span>
                {heartSent
                  ? 'Cœur envoyé'
                  : sending
                    ? 'Envoi...'
                    : matchStatus?.theySentHeart
                      ? 'Renvoyer un cœur — Match !'
                      : 'Envoyer un cœur'}
              </button>
            )}

            {error && profile && <p className="text-xs text-red-400 text-center">{error}</p>}

            {preview?.salonId && onSelectSalon && (
              <button
                type="button"
                onClick={() => {
                  onSelectSalon(preview.salonId!);
                  onClose();
                }}
                className="w-full py-2.5 rounded-xl border border-purple-500/40 text-purple-300 text-sm font-semibold hover:bg-purple-900/20"
              >
                Voir le salon · {preview.salonTitle ?? 'Écoute'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
