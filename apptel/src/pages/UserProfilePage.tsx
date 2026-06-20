import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { UserProfileView } from '../components/UserProfileView';
import { UserReelsSection } from '../components/UserReelsSection';
import { UserLivesSection } from '../components/UserLivesSection';
import { ReportContentButton } from '../components/ReportContentModal';
import { getProfileShareUrl } from '../lib/shareLink';
import type { NearbyPerson } from '../types';

interface UserProfilePageProps {
  userId: string;
  preview?: NearbyPerson;
  onBack: () => void;
  onOpenReel?: (reelId: string) => void;
  onSelectSalon?: (salonId: string, salonTitle?: string, isHost?: boolean) => void;
  onOpenLive?: (liveId: string) => void;
  /** Ouvre l’enregistreur reel sur le profil personnel (propriétaire). */
  onRecordReel?: () => void;
  /** Profil en panneau sur la carte : bande carte visible en haut (~10 %), clic fond → onBack. */
  mapOverlay?: boolean;
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
}: UserProfilePageProps) {
  const { user: me } = useAuth();
  const { t } = useTranslation();
  const isSelf = me?.id === userId;
  const [profileTab, setProfileTab] = useState<'profil' | 'reels' | 'lives'>('profil');
  const reelsTabLabel = isSelf ? t('profile.tabReels') : t('profile.tabReelsOther');
  const livesTabLabel = isSelf ? t('profile.tabLives') : t('profile.tabLivesOther');
  const displayName = preview?.username ?? 'Profil';
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    setProfileTab('profil');
  }, [userId]);

  const copyShareLink = useCallback(async () => {
    try {
      const url = await getProfileShareUrl(userId);
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [userId]);

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

  const headerClass = mapOverlay
    ? 'shrink-0 flex items-center gap-3 px-3 sm:px-4 py-3 border-b border-[#1e1e2f] bg-[#12121a]'
    : 'shrink-0 flex items-center gap-3 px-3 sm:px-4 py-3 border-b border-[#1e1e2f] bg-[#12121a] pt-[max(0.75rem,env(safe-area-inset-top))]';

  const profileContent = (
    <>
      <header className={headerClass}>
        <button
          type="button"
          onClick={onBack}
          className="shrink-0 text-gray-400 hover:text-white text-xl leading-none"
          aria-label="Retour"
        >
          ←
        </button>
        <h1 className="flex-1 min-w-0 font-bold text-white truncate">{displayName}</h1>
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
          <button
            type="button"
            onClick={() => void copyShareLink()}
            className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold text-purple-300 border border-purple-500/30 hover:bg-purple-900/20"
            title="Copier le lien du profil"
          >
            {shareCopied ? 'Copié !' : 'Partager'}
          </button>
        </div>
      </header>

      {(onOpenReel || onOpenLive) && (
        <div className="shrink-0 px-3 sm:px-4 py-2 border-b border-[#1e1e2f] bg-[#0b0b0f]">
          <div className="flex gap-1 p-1 max-w-lg mx-auto bg-[#12121a] border border-[#1e1e2f] rounded-xl">
            {(
              [
                ['profil', t('profile.tabProfil')],
                ...(onOpenReel ? ([['reels', reelsTabLabel]] as const) : []),
                ...(onOpenLive ? ([['lives', livesTabLabel]] as const) : []),
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setProfileTab(id as 'profil' | 'reels' | 'lives')}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${
                  profileTab === id
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {label}
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
          />
        ) : profileTab === 'reels' ? (
          onOpenReel && (
            <UserReelsSection
              userId={userId}
              isOwner={isSelf}
              layout="grid"
              hideSectionTitle
              defaultOwnerTab="published"
              onOpenReel={onOpenReel}
              onRecordReel={isSelf ? onRecordReel : undefined}
            />
          )
        ) : (
          <UserLivesSection
            userId={userId}
            isOwner={isSelf}
            hideSectionTitle
            onOpenLive={onOpenLive}
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
