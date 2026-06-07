import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useAuth } from './context/AuthContext';
import {
  consumePendingProfileView,
  parseProfileIdFromLocation,
  persistPendingProfileView,
  syncProfileUrlInBar,
  clearProfileUrlFromBar,
} from './lib/profileDeepLink';
import {
  consumePendingSalonJoin,
  parseSalonIdFromLocation,
  persistPendingSalonJoin,
  syncSalonUrlInBar,
  clearSalonUrlFromBar,
} from './lib/salonDeepLink';
import { pauseAllReelsMediaInDom } from './lib/reelsMedia';
import { pauseMediaElements } from './hooks/usePauseMediaOnPageHidden';
import { AuthPage } from './pages/AuthPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { HomePage } from './pages/HomePage';
import { ProfilePage } from './pages/ProfilePage';
import { LivesTabPage } from './pages/LivesTabPage';
import { ReelsTabPage } from './pages/ReelsTabPage';
import { NotificationBell } from './components/NotificationBell';
import { PrivacyVisibilityMenu } from './components/PrivacyVisibilityMenu';
import { useDmUnread } from './context/DmUnreadContext';
import { ProfileSearchBar } from './components/ProfileSearchBar';
import { MainTabNav } from './components/MainTabNav';
import type { NearbyPerson } from './types';

const DmPage = lazy(() => import('./pages/DmPage').then((m) => ({ default: m.DmPage })));
const ActualiteTabPage = lazy(() =>
  import('./pages/ActualiteTabPage').then((m) => ({ default: m.ActualiteTabPage }))
);
const LivePage = lazy(() => import('./pages/LivePage').then((m) => ({ default: m.LivePage })));
const SalonPage = lazy(() => import('./pages/SalonPage').then((m) => ({ default: m.SalonPage })));
const UserProfilePage = lazy(() =>
  import('./pages/UserProfilePage').then((m) => ({ default: m.UserProfilePage }))
);

function PageFallback() {
  return (
    <div className="flex flex-col flex-1 min-h-0 items-center justify-center gap-3 bg-[#0b0b0f] text-gray-400">
      <span className="w-7 h-7 border-2 border-purple-500/30 border-t-purple-400 rounded-full animate-spin" />
    </div>
  );
}

/** Apptel : toujours en mode appa2 → NearbyPanel en bandeau bas, pas de sidebar. */
const APPTEL_LAYOUT = 'appa2' as const;

type Tab = 'actualite' | 'map' | 'live' | 'dm' | 'reels';
type View =
  | { type: 'home' }
  | { type: 'salon'; id: string }
  | { type: 'live'; id: string }
  | { type: 'profile'; id: string };

export default function App() {
  const { user, token, isNewUser, clearNewUser, refreshUser, authBootError, clearAuthBootError } = useAuth();
  const { unreadCount: dmUnread, incomingToast, dismissToast, setDmTabActive } = useDmUnread();
  const [tab, setTab] = useState<Tab>('map');
  const [view, setView] = useState<View>({ type: 'home' });
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileOpenRecorder, setProfileOpenRecorder] = useState(false);
  const [profilePreview, setProfilePreview] = useState<NearbyPerson | null>(null);
  const [profileReturnView, setProfileReturnView] = useState<View>({ type: 'home' });
  /** Incrémenté à chaque ouverture profil carte → chat salon replié à nouveau. */
  const [reelsInitialId, setReelsInitialId] = useState<string | undefined>();
  const salonDeepLinkHandled = useRef(false);
  const profileDeepLinkHandled = useRef(false);
  const appLayout = APPTEL_LAYOUT;
  const [dmPeerToOpen, setDmPeerToOpen] = useState<string | null>(null);
  const [dmGroupToOpen, setDmGroupToOpen] = useState<string | null>(null);

  useEffect(() => {
    const id = parseSalonIdFromLocation();
    if (id) persistPendingSalonJoin(id);
    const profileId = parseProfileIdFromLocation();
    if (profileId) persistPendingProfileView(profileId);
  }, []);

  useEffect(() => {
    if (!user || !token || salonDeepLinkHandled.current) return;
    const fromUrl = parseSalonIdFromLocation();
    const pending = consumePendingSalonJoin();
    const salonId = fromUrl ?? pending;
    if (!salonId) return;
    salonDeepLinkHandled.current = true;
    setTab('map');
    setProfileOpen(false);
    setProfilePreview(null);
    setView({ type: 'salon', id: salonId });
    syncSalonUrlInBar(salonId);
  }, [user, token]);

  useEffect(() => {
    if (!user || !token || profileDeepLinkHandled.current) return;
    if (parseSalonIdFromLocation()) return;
    const fromUrl = parseProfileIdFromLocation();
    const pending = consumePendingProfileView();
    const profileId = fromUrl ?? pending;
    if (!profileId) return;
    profileDeepLinkHandled.current = true;
    setProfileReturnView({ type: 'home' });
    setProfilePreview(null);
    setView({ type: 'profile', id: profileId });
    syncProfileUrlInBar(profileId);
  }, [user, token]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauth = params.get('youtube_oauth');
    if (!oauth) return;
    if (oauth === 'ok' && token) void refreshUser();
    if (oauth === 'error') {
      alert('Connexion YouTube annulée ou échouée.');
    }
    params.delete('youtube_oauth');
    const q = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${q ? `?${q}` : ''}`);
  }, [token, refreshUser]);

  useEffect(() => {
    const dmTabActive =
      Boolean(user && token) && tab === 'dm' && !profileOpen && view.type === 'home';
    setDmTabActive(dmTabActive);
  }, [user, token, tab, profileOpen, view.type, setDmTabActive]);

  const openReelInTab = (reelId: string) => {
    setProfileOpen(false);
    setReelsInitialId(reelId);
    setTab('reels');
    setView({ type: 'home' });
  };

  const openOwnProfileRecorder = () => {
    setProfileOpenRecorder(true);
    setProfileOpen(true);
  };

  const clearReelsIntent = () => {
    setReelsInitialId(undefined);
  };

  const openProfile = (userId: string, preview?: NearbyPerson) => {
    setProfileReturnView(view);
    setProfilePreview(preview ?? null);
    setProfileOpen(false);
    setView({ type: 'profile', id: userId });
    syncProfileUrlInBar(userId);
  };

  const closeProfile = () => {
    setView(profileReturnView);
    setProfilePreview(null);
    if (parseProfileIdFromLocation()) {
      clearProfileUrlFromBar();
    }
  };

  const openSalonPage = (salonId: string) => {
    setProfileOpen(false);
    setProfilePreview(null);
    if (view.type === 'profile' && parseProfileIdFromLocation()) {
      clearProfileUrlFromBar();
    }
    setView({ type: 'salon', id: salonId });
    syncSalonUrlInBar(salonId);
  };

  if (authBootError) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4 bg-[#0b0b0f] text-gray-300 px-6 text-center">
        <p className="text-sm text-red-300 max-w-md">{authBootError}</p>
        <button
          type="button"
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm text-white"
          onClick={() => {
            clearAuthBootError();
            window.location.reload();
          }}
        >
          Réessayer
        </button>
      </div>
    );
  }

  if (token && !user) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-3 bg-[#0b0b0f] text-gray-400">
        <span className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-400 rounded-full animate-spin" />
        <p className="text-sm">Chargement de la session…</p>
      </div>
    );
  }

  if (!user || !token) return <AuthPage />;

  if (isNewUser) return <OnboardingPage onDone={clearNewUser} />;

  const reelsActive = tab === 'reels' && !profileOpen && view.type === 'home';
  const mapPlaybackActive = tab === 'map' && view.type === 'home' && !profileOpen;
  const liveViewActive = tab === 'live' || view.type === 'live';
  const immersiveView = view.type === 'salon' || view.type === 'profile';

  const hideStartLiveOnMap = profileOpen;

  const stopReelsMedia = () => {
    pauseAllReelsMediaInDom({ resetPosition: true });
  };

  const openLive = (id: string) => {
    if (tab === 'reels') stopReelsMedia();
    pauseMediaElements();
    setProfileOpen(false);
    setTab('live');
    setView({ type: 'live', id });
  };

  const closeLive = () => {
    setView({ type: 'home' });
    setTab('live');
  };

  const openDmWithUser = (userId: string) => {
    if (tab === 'reels') stopReelsMedia();
    pauseMediaElements();
    setProfileOpen(false);
    setProfilePreview(null);
    setView({ type: 'home' });
    setDmGroupToOpen(null);
    setDmPeerToOpen(userId);
    setTab('dm');
    dismissToast();
  };

  const openGroupChat = (groupId: string) => {
    if (tab === 'reels') stopReelsMedia();
    pauseMediaElements();
    setProfileOpen(false);
    setProfilePreview(null);
    setView({ type: 'home' });
    setDmPeerToOpen(null);
    setDmGroupToOpen(groupId);
    setTab('dm');
    dismissToast();
  };

  const selectTab = (id: Tab) => {
    if (tab === 'reels' && id !== 'reels') stopReelsMedia();
    if (id !== 'reels') pauseMediaElements();
    setProfileOpen(false);
    setView({ type: 'home' });
    setTab(id);
  };

  return (
    <div className="ms-phone-shell flex flex-col min-h-dvh max-h-dvh overflow-hidden">
      {incomingToast && (
        <button
          type="button"
          onClick={() =>
            incomingToast.groupId
              ? openGroupChat(incomingToast.groupId)
              : openDmWithUser(incomingToast.senderId)
          }
          className="fixed top-14 left-3 right-3 z-50 mx-auto max-w-md rounded-xl border border-purple-500/40 bg-[#1a1a28] px-4 py-3 shadow-lg flex items-start gap-3 text-left w-[calc(100%-1.5rem)] active:scale-[0.99]"
          role="status"
        >
          <span className="text-xl shrink-0" aria-hidden>
            ðŸ’¬
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{incomingToast.senderName}</p>
            <p className="text-xs text-gray-400 line-clamp-2">{incomingToast.preview}</p>
          </div>
          <span
            role="presentation"
            onClick={(e) => {
              e.stopPropagation();
              dismissToast();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                dismissToast();
              }
            }}
            className="text-gray-500 hover:text-white text-lg leading-none shrink-0 cursor-pointer"
            aria-label="Fermer"
          >
            ×
          </span>
        </button>
      )}

      {!immersiveView && (
      <header className="ms-app-header">
        <div className="px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-1.5 min-w-0">
            <div className="flex items-center gap-1.5 justify-self-start min-w-0 overflow-hidden">
              <button
                type="button"
                onClick={() => selectTab('map')}
                className="text-lg font-extrabold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent shrink-0 cursor-pointer hover:opacity-75 active:scale-95 transition"
                title="Retour à la Carte"
                aria-label="Aller à la carte"
              >
                Soundly
              </button>
            </div>
            <div className="justify-self-center w-[min(100%,17.5rem)] min-w-[8.5rem] px-0.5">
              <ProfileSearchBar
                token={token}
                onSelectUser={(id, preview) => openProfile(id, preview)}
              />
            </div>
            <div className="flex items-center gap-1 justify-self-end shrink-0">
              <PrivacyVisibilityMenu />
              <NotificationBell
                onOpenLive={openLive}
                onOpenProfile={(id) => openProfile(id)}
                onOpenDm={openDmWithUser}
                onOpenGroup={openGroupChat}
              />
              <button
                type="button"
                onClick={() => {
                  if (tab === 'reels') stopReelsMedia();
                  setProfileOpen(true);
                }}
                className="rounded-full ring-2 ring-purple-500/40 hover:ring-purple-400 active:scale-95 transition"
                title="Mon profil"
                aria-label="Ouvrir mon profil"
              >
                <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
              </button>
            </div>
          </div>
        </div>
      </header>
      )}

      <main
        className={`ms-app-main ms-phone-main flex-1 min-h-0 overflow-hidden flex flex-col relative${immersiveView ? ' ms-app-main--no-header' : ''}`}
      >
        {view.type === 'salon' && (
          <Suspense fallback={<PageFallback />}>
            <SalonPage
              salonId={view.id}
              onBack={() => {
                clearSalonUrlFromBar();
                setView({ type: 'home' });
                setTab('map');
              }}
            />
          </Suspense>
        )}
        {view.type === 'profile' && (
          <Suspense fallback={<PageFallback />}>
            <UserProfilePage
              userId={view.id}
              preview={profilePreview ?? undefined}
              onBack={closeProfile}
              onOpenReel={(reelId) => {
                closeProfile();
                openReelInTab(reelId);
              }}
              onRecordReel={
                view.id === user.id
                  ? () => {
                      closeProfile();
                      openOwnProfileRecorder();
                    }
                  : undefined
              }
              onSelectSalon={(salonId) => openSalonPage(salonId)}
              onOpenLive={(liveId) => {
                clearProfileUrlFromBar();
                setProfilePreview(null);
                setTab('live');
                setView({ type: 'live', id: liveId });
              }}
            />
          </Suspense>
        )}
        {view.type === 'live' && !profileOpen && (
          <Suspense fallback={<PageFallback />}>
            <LivePage
              liveId={view.id}
              onBack={closeLive}
              onOpenProfile={(id) => openProfile(id)}
            />
          </Suspense>
        )}
        {view.type === 'home' && (
          <>
            <div
              className={
                tab === 'actualite'
                  ? 'flex flex-col flex-1 min-h-0 overflow-hidden'
                  : 'hidden'
              }
              aria-hidden={tab !== 'actualite'}
            >
              <Suspense fallback={<PageFallback />}>
                <ActualiteTabPage
                  onOpenProfile={(id) => openProfile(id)}
                  isActive={tab === 'actualite' && !profileOpen}
                />
              </Suspense>
            </div>
            <div
              className={tab === 'map' ? 'flex flex-col flex-1 min-h-0 overflow-hidden' : 'hidden'}
              aria-hidden={tab !== 'map'}
            >
              <HomePage
                appLayout={appLayout}
                onOpenSalon={openSalonPage}
                onOpenLive={openLive}
                onOpenProfile={(person) => openProfile(person.id, person)}
                onOpenReel={openReelInTab}
                hideStartLiveMapButton={hideStartLiveOnMap}
                onCloseMapProfile={closeProfile}
                mapPlaybackActive={mapPlaybackActive}
              />
            </div>
            <div
              className={tab === 'live' ? 'flex flex-col flex-1 min-h-0 overflow-hidden' : 'hidden'}
              aria-hidden={tab !== 'live'}
            >
              <LivesTabPage onOpenLive={openLive} />
            </div>
            <div
              className={tab === 'dm' ? 'flex flex-col flex-1 min-h-0 overflow-hidden' : 'hidden'}
              aria-hidden={tab !== 'dm'}
            >
              <Suspense fallback={<PageFallback />}>
                <DmPage
                  openPeerId={dmPeerToOpen}
                  openGroupId={dmGroupToOpen}
                  onOpenPeerConsumed={() => setDmPeerToOpen(null)}
                  onOpenGroupConsumed={() => setDmGroupToOpen(null)}
                  onOpenProfile={(id) => {
                    setDmPeerToOpen(id);
                    setTab('dm');
                    openProfile(id);
                  }}
                />
              </Suspense>
            </div>
            <div
              className={
                tab === 'reels'
                  ? 'flex flex-col flex-1 min-h-0 w-full overflow-hidden'
                  : 'hidden'
              }
              aria-hidden={tab !== 'reels'}
            >
              <ReelsTabPage
                onOpenLive={openLive}
                initialReelId={reelsInitialId}
                onIntentHandled={clearReelsIntent}
                isActive={reelsActive}
              />
            </div>
          </>
        )}

        {profileOpen && (
          <div className="absolute inset-0 z-30 flex flex-col min-h-0 bg-[#0b0b0f]">
            <ProfilePage
              onBack={() => setProfileOpen(false)}
              onOpenReel={openReelInTab}
              openRecorderOnMount={profileOpenRecorder}
              onRecorderMountHandled={() => setProfileOpenRecorder(false)}
            />
          </div>
        )}

      </main>

      <MainTabNav
        tab={tab}
        liveViewActive={liveViewActive}
        dmUnread={dmUnread}
        onSelectTab={selectTab}
        placement="bottom"
      />
    </div>
  );
}
