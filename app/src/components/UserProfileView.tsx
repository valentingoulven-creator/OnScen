import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { useMatchCreated } from '../lib/useMatchCreated';
import { HostRatingBlock } from './HostRatingBlock';
import { ProfilePhotoGallery } from './ProfilePhotoGallery';
import { formatCompactCount, formatFavoritesCountLabel } from '../lib/formatCount';
import { resolveProfileLiveId } from '../lib/profileLive';
import { FollowUserButton } from './FollowUserButton';
import { UsernameDisplay } from './UsernameDisplay';
import { ProfileCurrentListening } from './ProfileCurrentListening';
import { getProfileTypeLabel } from '../lib/profileTypes';
import type {
  CurrentListening,
  MatchStatus,
  MusicMatch,
  NearbyPerson,
  RelationshipStatus,
  User,
} from '../types';

const ROLE_LABELS: Record<string, string> = {
  auditeur: 'Auditeur',
  host: 'Host / DJ',
  les_deux: 'Auditeur & Host',
};

const RELATIONSHIP_LABELS: Record<RelationshipStatus, string> = {
  celibataire: 'Célibataire',
  en_couple: 'En couple',
};

interface UserProfileViewProps {
  userId: string;
  preview?: NearbyPerson;
  onOpenLive?: (liveId: string) => void;
  /** Salon actif (preview carte ou profil API) remonté au parent pour le pied de page fixe. */
  onSalonInfo?: (info: { salonId: string; salonTitle?: string } | null) => void;
}

export function UserProfileView({
  userId,
  preview,
  onOpenLive,
  onSalonInfo,
}: UserProfileViewProps) {
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
    Promise.all([api.getUserProfile(token, userId), api.getMatchStatus(token, userId)])
      .then(([profileRes, statusRes]) => {
        setProfile(profileRes.user);
        setMatchStatus(statusRes);
        setHeartSent(statusRes.iSentHeart);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Profil introuvable'))
      .finally(() => setLoading(false));
  }, [token, userId]);

  const applyRemoteMatch = useCallback(
    (match: MusicMatch) => {
      setJustMatched(match);
      setHeartSent(true);
      setMatchStatus((s) =>
        s
          ? { ...s, matched: true, match, iSentHeart: true, theySentHeart: true }
          : { matched: true, match, iSentHeart: true, theySentHeart: true }
      );
    },
    []
  );

  useMatchCreated(
    (payload) => {
      if (payload.otherUser.id !== userId) return;
      applyRemoteMatch({
        id: payload.matchId,
        createdAt: payload.createdAt,
        otherUser: payload.otherUser,
      });
    },
    Boolean(token && !isSelf && !isMatched)
  );

  useEffect(() => {
    if (!onSalonInfo) return;
    const salonId = profile?.salonId ?? preview?.salonId;
    if (!salonId) {
      onSalonInfo(null);
      return;
    }
    const salonTitle = profile?.salonTitle ?? preview?.salonTitle;
    onSalonInfo({ salonId, salonTitle });
  }, [
    onSalonInfo,
    preview?.salonId,
    preview?.salonTitle,
    profile?.salonId,
    profile?.salonTitle,
  ]);

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
        applyRemoteMatch(r.match);
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
  const displayColor = profile?.usernameColor ?? preview?.usernameColor;
  const displayWaveFrom = profile?.usernameWaveFrom ?? preview?.usernameWaveFrom;
  const displayWaveTo = profile?.usernameWaveTo ?? preview?.usernameWaveTo;
  const isLiveHost = Boolean(profile?.isLive || preview?.isLive);
  const liveId = resolveProfileLiveId(profile, preview);
  const liveViewers =
    profile?.liveViewersCount ?? preview?.liveViewersCount;
  const currentListening: CurrentListening | undefined =
    profile?.currentListening ?? preview?.currentListening;

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

  if (loading) {
    return <p className="p-8 text-center text-gray-500 text-sm">Chargement du profil...</p>;
  }

  if (error && !profile) {
    return <p className="p-8 text-center text-red-400 text-sm">{error}</p>;
  }

  if (!profile && !preview) {
    return null;
  }

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto w-full">
      {(isMatched || justMatched) && (
        <div className="text-center p-4 rounded-xl bg-gradient-to-br from-pink-900/50 to-purple-900/40 border border-pink-500/40">
          <p className="text-3xl mb-1">💞</p>
          <p className="text-lg font-bold text-white">Match musical !</p>
          <p className="text-sm text-pink-200 mt-1">
            Vous et {displayName} partagez les mêmes vibes
          </p>
        </div>
      )}

      <div className="min-w-0">
        <UsernameDisplay
          as="p"
          username={displayName}
          usernameColor={displayColor}
          usernameWaveFrom={displayWaveFrom}
          usernameWaveTo={displayWaveTo}
          className="text-xl font-bold truncate"
        />
        {profile?.profileType && (
          <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/20 text-purple-200 border border-purple-500/30">
            {getProfileTypeLabel(profile.profileType)}
          </span>
        )}
        {profile?.listeningRole && (
          <p className="text-sm text-purple-300 mt-0.5">
            {ROLE_LABELS[profile.listeningRole] ?? profile.listeningRole}
          </p>
        )}
        {profile?.city && <p className="text-xs text-gray-400 mt-0.5">📍 {profile.city}</p>}
        {profile?.age != null && (
          <p className="text-sm text-gray-400 mt-0.5">{profile.age} ans</p>
        )}
        {profile?.relationshipStatus && (
          <p className="text-xs text-pink-300/90 mt-0.5">
            {profile.relationshipStatus === 'en_couple' ? '💑' : '✨'}{' '}
            {RELATIONSHIP_LABELS[profile.relationshipStatus]}
          </p>
        )}
        {profile?.favoritesCount != null && (
          <p className="text-xs text-amber-300/90 mt-0.5" title="Personnes qui ont ajouté ce profil en favoris">
            ⭐ {formatFavoritesCountLabel(profile.favoritesCount)}
          </p>
        )}
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

      {currentListening && <ProfileCurrentListening listening={currentListening} />}

      <section>
        <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-2">
          Photos{photos.length > 0 ? ` (${photos.length})` : ''}
        </h3>
        <div
          className={`rounded-2xl ${
            profile?.isLive || preview?.isLive
              ? 'p-1 bg-gradient-to-br from-red-500 via-rose-500 to-red-600 shadow-[0_0_16px_rgba(239,68,68,0.45)]'
              : ''
          }`}
        >
          <ProfilePhotoGallery photos={photos} fallbackSeed={userId} editing={false} />
        </div>
        {isLiveHost && (
          <p className="text-center text-xs text-red-400 font-bold mt-2">
            🔴 En live
            {liveViewers != null && (
              <>
                {' '}
                · {formatCompactCount(liveViewers)} spectateurs
              </>
            )}
          </p>
        )}
      </section>

      {isLiveHost && liveId && onOpenLive && (
        <button
          type="button"
          onClick={() => onOpenLive(liveId)}
          className="w-full py-3.5 rounded-xl font-bold text-white flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 shadow-lg shadow-red-900/40 transition active:scale-[0.99]"
        >
          <span className="text-lg" aria-hidden>
            🔴
          </span>
          Rejoindre le live
          {liveViewers != null && (
            <span className="text-sm font-semibold text-red-100/90">
              · {formatCompactCount(liveViewers)} spectateurs
            </span>
          )}
        </button>
      )}

      {profile?.bio && <p className="text-sm text-gray-300 leading-relaxed">{profile.bio}</p>}

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
    </div>
  );
}
