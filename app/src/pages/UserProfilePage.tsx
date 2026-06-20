import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { UserProfileView } from '../components/UserProfileView';
import { UserReelsSection } from '../components/UserReelsSection';
import { UserLivesSection } from '../components/UserLivesSection';
import { UserCompositionsSection } from '../components/UserCompositionsSection';
import { UserEventsSection } from '../components/UserEventsSection';
import { ReportContentButton } from '../components/ReportContentModal';
import { ShareProfileLink } from '../components/ShareProfileLink';
import { UsernameDisplay } from '../components/UsernameDisplay';
import type { FeedPost, NearbyPerson } from '../types';

interface UserProfilePageProps {
  userId: string;
  preview?: NearbyPerson;
  onBack: () => void;
  onOpenReel?: (reelId: string) => void;
  onSelectSalon?: (salonId: string, salonTitle?: string, isHost?: boolean) => void;
  onOpenLive?: (liveId: string) => void;
  /** Ouvre l'enregistreur reel sur le profil personnel (propriétaire). */
  onRecordReel?: () => void;
  /** Profil en panneau sur la carte : bande carte visible en haut (~10 %), clic fond → onBack. */
  mapOverlay?: boolean;
  /** Ouvre la conversation DM avec cet utilisateur. */
  onOpenDm?: (userId: string) => void;
  /** Ouvre le détail d'une publication événement. */
  onOpenFeedPost?: (post: FeedPost) => void;
}

export function UserProfilePage({
  userId,
  preview,
  onBack,
  onOpenReel,
  onSelectSalon,
  onOpenLive,
  onRecordReel,
  mapOverlay = false,
  onOpenDm,
  onOpenFeedPost,
}: UserProfilePageProps) {
  const { user: me, token } = useAuth();
  const { t } = useTranslation();
  const isSelf = me?.id === userId;
  const [profileTab, setProfileTab] = useState<'profil' | 'reels' | 'lives' | 'events' | 'compositions'>('profil');
  const [compositionsRefreshKey, setCompositionsRefreshKey] = useState(0);
  const [canViewPrivateReels, setCanViewPrivateReels] = useState(isSelf);
  const reelsTabLabel = isSelf ? t('profile.tabReels') : t('profile.tabReelsOther');
  const livesTabLabel = isSelf ? t('profile.tabLives') : t('profile.tabLivesOther');
  const displayName = preview?.username ?? 'Profil';

  useEffect(() => {
    setProfileTab('profil');
  }, [userId]);

  useEffect(() => {
    if (isSelf) {
      setCanViewPrivateReels(true);
      return;
    }
    if (!token) {
      setCanViewPrivateReels(false);
      return;
    }
    let cancelled = false;
    api
      .getUserProfile(token, userId)
      .then((res) => {
        if (cancelled) return;
        setCanViewPrivateReels(Boolean(res.user.isFollowing && res.user.isFollowingMe));
      })
      .catch(() => {
        if (!cancelled) setCanViewPrivateReels(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, userId, isSelf, profileTab]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);

  const panelClass = mapOverlay
    ? 'absolute inset-x-0 bottom-0 top-[10%] flex flex-col min-h-0 max-h-none overflow-hidden bg-[#0b0b0f] rounded-t-2xl border-t border-[#1e1e2f] shadow-[0_-8px_40px_rgba(0,0,0,0.55)] pointer-events-auto'
    : 'flex flex-col flex-1 min-h-0 h-full overflow-hidden bg-[#0b0b0f]';

  const tabs = [
    ['profil', t('profile.tabProfil')],
    ...(onOpenReel ? ([['reels', reelsTabLabel]] as const) : []),
    ['compositions', t('profile.tabCompositions')],
    ...(onOpenLive ? ([['lives', livesTabLabel]] as const) : []),
    ['events', t('profile.tabEvents')],
  ] as const;

  const hasTabs = true;

  const profileContent = (
    <>
      {/* ── MINIMAL HEADER ── */}
      <header
        className={
          mapOverlay
            ? 'shrink-0 flex items-center gap-2 px-3 sm:px-4 py-3 bg-[#0b0b0f]/95 backdrop-blur-sm border-b border-[#1e1e2f]/60'
            : 'shrink-0 flex items-center gap-2 px-3 sm:px-4 py-3 bg-[#0b0b0f]/95 backdrop-blur-sm border-b border-[#1e1e2f]/60 pt-[max(0.75rem,env(safe-area-inset-top))]'
        }
      >
        {/* Back button */}
        <button
          type="button"
          onClick={onBack}
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-[#1a1a26]/80 border border-[#2d2d3d] text-gray-400 hover:text-white hover:border-[#3d3d50] transition active:scale-95"
          aria-label="Retour"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <UsernameDisplay
          as="h1"
          username={displayName}
          usernameColor={preview?.usernameColor}
          usernameWaveFrom={preview?.usernameWaveFrom}
          usernameWaveTo={preview?.usernameWaveTo}
          className="flex-1 min-w-0 font-bold truncate text-sm"
        />

        <div className="flex items-center gap-1 shrink-0">
          {!isSelf && (
            <ReportContentButton
              context={{
                targetUserId: userId,
                targetUsername: displayName,
                roomType: 'profile',
              }}
            />
          )}
          <ShareProfileLink userId={userId} username={displayName} />
        </div>
      </header>

      {/* ── TABS (underline style) ── */}
      {hasTabs && (
        <div className="shrink-0 border-b border-[#1e1e2f] bg-[#0b0b0f]">
          <div className="flex max-w-lg mx-auto">
            {tabs.map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  const tab = id as 'profil' | 'reels' | 'lives' | 'events' | 'compositions';
                  setProfileTab(tab);
                  if (tab === 'compositions') setCompositionsRefreshKey((k) => k + 1);
                }}
                className={`relative flex-1 py-3 text-xs font-bold uppercase tracking-wider transition ${
                  profileTab === id
                    ? 'text-white'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {label}
                {profileTab === id && (
                  <span
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] w-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
                    style={{ boxShadow: '0 0 8px rgba(168,85,247,0.7)' }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <main className="flex-1 min-h-0 overflow-y-auto">
        {profileTab === 'profil' ? (
          <UserProfileView
            userId={userId}
            preview={preview}
            onOpenLive={onOpenLive}
            onOpenSalon={onSelectSalon}
            onOpenDm={onOpenDm}
          />
        ) : profileTab === 'reels' ? (
          onOpenReel && (
            <UserReelsSection
              userId={userId}
              isOwner={isSelf}
              canViewPrivateReels={canViewPrivateReels}
              layout="grid"
              hideSectionTitle
              defaultOwnerTab="published"
              defaultArtist={isSelf ? (me?.username ?? '') : ''}
              onOpenReel={onOpenReel}
              onRecordReel={isSelf ? onRecordReel : undefined}
            />
          )
        ) : profileTab === 'compositions' ? (
          <UserCompositionsSection
            userId={userId}
            readOnly={!isSelf}
            defaultArtist={isSelf ? (me?.username ?? '') : displayName}
            refreshKey={compositionsRefreshKey}
          />
        ) : profileTab === 'lives' ? (
          <UserLivesSection
            userId={userId}
            isOwner={isSelf}
            hideSectionTitle
            onOpenLive={onOpenLive}
          />
        ) : (
          <UserEventsSection
            userId={userId}
            onOpenPost={onOpenFeedPost}
          />
        )}
      </main>

    </>
  );

  if (mapOverlay) {
    return (
      <div className="absolute inset-0 z-40 pointer-events-none">
        <div className={panelClass}>{profileContent}</div>
      </div>
    );
  }

  return <div className={panelClass}>{profileContent}</div>;
}
