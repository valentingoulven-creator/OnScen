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
import { useAndroidBackButton } from './hooks/useAndroidBackButton';
import { useNativePushRegistration } from './hooks/useNativePushRegistration';
import { AuthPage } from './pages/AuthPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { EmailVerificationPage } from './pages/EmailVerificationPage';
import {
  isForgotPasswordRoute,
  isResetPasswordRoute,
  isVerifyEmailRoute,
} from './lib/forgotPasswordRoute';
import { OnboardingPage } from './pages/OnboardingPage';
import { NotificationBell } from './components/NotificationBell';
import { SettingsHeaderButton } from './components/SettingsHeaderButton';
import { useDmUnread } from './context/DmUnreadContext';
import { ProfileSearchBar, nearbyPreviewFromSearchItem } from './components/ProfileSearchBar';
import type { GlobalSearchResultItem } from './components/ProfileSearchBar';
import { MainTabNav } from './components/MainTabNav';
import type { NearbyPerson } from './types';
import type { HomePageHandle } from './pages/HomePage';

const DmPage = lazy(() => import('./pages/DmPage').then((m) => ({ default: m.DmPage })));
const ActualiteTabPage = lazy(() =>
  import('./pages/ActualiteTabPage').then((m) => ({ default: m.ActualiteTabPage }))
);
const LivePage = lazy(() => import('./pages/LivePage').then((m) => ({ default: m.LivePage })));
const SalonPage = lazy(() => import('./pages/SalonPage').then((m) => ({ default: m.SalonPage })));
const UserProfilePage = lazy(() =>
  import('./pages/UserProfilePage').then((m) => ({ default: m.UserProfilePage }))
);
const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const LivesTabPage = lazy(() =>
  import('./pages/LivesTabPage').then((m) => ({ default: m.LivesTabPage }))
);
const ReelsTabPage = lazy(() =>
  import('./pages/ReelsTabPage').then((m) => ({ default: m.ReelsTabPage }))
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
  const { user, token, completeOnboarding, refreshUser, authBootError, clearAuthBootError } = useAuth();
  const { unreadCount: dmUnread, incomingToast, dismissToast, setDmTabActive } = useDmUnread();
  const [tab, setTab] = useState<Tab>('map');
  const [view, setView] = useState<View>({ type: 'home' });
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpenRecorder, setProfileOpenRecorder] = useState(false);
  const [profilePreview, setProfilePreview] = useState<NearbyPerson | null>(null);
  const [profileReturnView, setProfileReturnView] = useState<View>({ type: 'home' });
  /** Incrémenté à chaque ouverture profil carte → chat salon replié à nouveau. */
  const [reelsInitialId, setReelsInitialId] = useState<string | undefined>();
  const salonDeepLinkHandled = useRef(false);
  const profileDeepLinkHandled = useRef(false);
  const homePageRef = useRef<HomePageHandle>(null);
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

  useNativePushRegistration(token);

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

  /**
   * Bouton retour matériel Android : referme l'overlay ouvert (profil > vue
   * salon/live/profil > onglet non-carte) avant de minimiser l'app. Sans ça,
   * le retour matériel ferme l'app directement au lieu de fermer l'overlay
   * courant — cf. audit mobile, gap navigation Android.
   */
  useAndroidBackButton(() => {
    if (settingsOpen) {
      setSettingsOpen(false);
      return true;
    }
    if (profileOpen) {
      setProfileOpen(false);
      return true;
    }
    if (view.type === 'profile') {
      closeProfile();
      return true;
    }
    if (view.type !== 'home') {
      setView({ type: 'home' });
      return true;
    }
    // Onglet Carte à l'état racine (pas de vue/profil ouvert) : referme les
    // overlays internes de la carte (fiche salon, liste proximité) avant de
    // basculer d'onglet / minimiser — sinon le retour matériel Android
    // minimisait l'app directement en ignorant ces overlays.
    if (tab === 'map' && homePageRef.current?.handleBackPress()) {
      return true;
    }
    if (tab !== 'map') {
      setTab('map');
      return true;
    }
    return false;
  });

  const openSalonPage = (salonId: string) => {
    setProfileOpen(false);
    setProfilePreview(null);
    if (view.type === 'profile' && parseProfileIdFromLocation()) {
      clearProfileUrlFromBar();
    }
    setView({ type: 'salon', id: salonId });
    syncSalonUrlInBar(salonId);
  };

  const openFeedPost = (postId: string) => {
    setProfileOpen(false);
    setProfilePreview(null);
    setView({ type: 'home' });
    setTab('actualite');
    window.location.hash = `#/post/${encodeURIComponent(postId)}`;
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

  if (!user || !token) {
    if (isForgotPasswordRoute()) return <ForgotPasswordPage />;
    if (isResetPasswordRoute()) return <ResetPasswordPage />;
    if (isVerifyEmailRoute()) return <EmailVerificationPage />;
    return <AuthPage />;
  }

  if (!user.onboardingCompleted) return <OnboardingPage onDone={completeOnboarding} />;

  const reelsActive = tab === 'reels' && !profileOpen && view.type === 'home';
  const mapPlaybackActive = tab === 'map' && view.type === 'home' && !profileOpen;
  const liveViewActive = tab === 'live' || view.type === 'live';
  const tabContentBase = view.type === 'home';
  const actualiteTabMounted = tab === 'actualite' && tabContentBase && !profileOpen;
  const mapTabMounted = tab === 'map' && tabContentBase && !profileOpen;
  const liveTabMounted = tab === 'live' && tabContentBase && !profileOpen;
  const dmTabMounted = tab === 'dm' && tabContentBase && !profileOpen;
  const reelsTabMounted = tab === 'reels' && tabContentBase && !profileOpen;

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
    setSettingsOpen(false);
    setView({ type: 'home' });
    setTab(id);
  };

  const openSettingsPanel = () => {
    if (tab === 'reels') stopReelsMedia();
    pauseMediaElements();
    setProfileOpen(false);
    setSettingsOpen(true);
  };

  const handleGlobalSearchSelect = (item: GlobalSearchResultItem) => {
    switch (item.kind) {
      case 'user':
        openProfile(item.id, nearbyPreviewFromSearchItem(item));
        return;
      case 'city':
      case 'country':
        selectTab('map');
        return;
      case 'event':
        openFeedPost(item.id);
        return;
      case 'album':
      case 'song':
        openProfile(item.userId);
        return;
      default:
        return;
    }
  };

  return (
    <div className="ms-phone-shell ms-app-shell flex flex-col min-h-dvh max-h-dvh overflow-hidden min-w-0 w-full">
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
            💬
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

      <header className="ms-app-header">
        <div className="px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-1.5 min-w-0">
            <div className="flex items-center gap-1.5 justify-self-start min-w-0 overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  if (tab === 'reels') stopReelsMedia();
                  setProfileOpen(true);
                }}
                className="flex items-center gap-1.5 shrink-0 rounded-full ring-2 ring-purple-500/40 hover:ring-purple-400 active:scale-95 transition min-h-11 min-w-11 pl-0.5 pr-2 cursor-pointer bg-transparent border-0"
                title="Mon profil"
                aria-label="Ouvrir mon profil"
              >
                <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                <span className="hidden min-[400px]:inline text-xs font-semibold text-white/90 whitespace-nowrap">
                  Mon profil
                </span>
              </button>
            </div>
            <div className="justify-self-center w-[min(100%,17.5rem)] min-w-[8.5rem] px-0.5">
              <ProfileSearchBar
                token={token}
                onSelectResult={handleGlobalSearchSelect}
              />
            </div>
            <div className="flex items-center gap-1 justify-self-end shrink-0">
              <NotificationBell
                onOpenLive={openLive}
                onOpenProfile={(id) => openProfile(id)}
                onOpenDm={openDmWithUser}
                onOpenGroup={openGroupChat}
              />
              <SettingsHeaderButton onClick={openSettingsPanel} active={settingsOpen} />
            </div>
          </div>
        </div>
      </header>

      <main
        className={`ms-app-main ms-phone-main flex-1 min-h-0 overflow-hidden flex flex-col relative${view.type === 'salon' ? ' ms-app-main--salon' : ''}`}
      >
        {view.type === 'salon' && (
          <div className="ms-salon-page-overlay flex flex-col flex-1 min-h-0 absolute inset-0 z-40 bg-[#0b0b0f] overflow-hidden">
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
          </div>
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
            {actualiteTabMounted && (
              <Suspense fallback={<PageFallback />}>
                <ActualiteTabPage
                  onOpenProfile={(id) => openProfile(id)}
                  isActive
                />
              </Suspense>
            )}
            {mapTabMounted && (
              <Suspense fallback={<PageFallback />}>
                <HomePage
                  ref={homePageRef}
                  appLayout={appLayout}
                  onOpenSalon={openSalonPage}
                  onOpenLive={openLive}
                  onOpenProfile={(person) => openProfile(person.id, person)}
                  onOpenReel={openReelInTab}
                  onCloseMapProfile={closeProfile}
                  mapPlaybackActive={mapPlaybackActive}
                />
              </Suspense>
            )}
            {liveTabMounted && (
              <Suspense fallback={<PageFallback />}>
                <LivesTabPage onOpenLive={openLive} />
              </Suspense>
            )}
            {dmTabMounted && (
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
                  onOpenSalon={openSalonPage}
                  onOpenFeedPost={openFeedPost}
                />
              </Suspense>
            )}
            {reelsTabMounted && (
              <Suspense fallback={<PageFallback />}>
                <ReelsTabPage
                  onOpenLive={openLive}
                  initialReelId={reelsInitialId}
                  onIntentHandled={clearReelsIntent}
                  isActive={reelsActive}
                />
              </Suspense>
            )}
          </>
        )}

        {profileOpen && (
          <div className="ms-app-profile-overlay flex flex-col min-h-0 bg-[#0b0b0f]">
            <Suspense fallback={<PageFallback />}>
              <ProfilePage
                onBack={() => setProfileOpen(false)}
                onOpenReel={openReelInTab}
                onOpenLive={openLive}
                openRecorderOnMount={profileOpenRecorder}
                onRecorderMountHandled={() => setProfileOpenRecorder(false)}
              />
            </Suspense>
          </div>
        )}

        {settingsOpen && (
          <div className="ms-app-profile-overlay flex flex-col min-h-0 bg-[#0b0b0f]">
            <Suspense fallback={<PageFallback />}>
              <SettingsPage onBack={() => setSettingsOpen(false)} />
            </Suspense>
          </div>
        )}

      </main>

      {view.type !== 'salon' && (
      <MainTabNav
        tab={tab}
        liveViewActive={liveViewActive}
        dmUnread={dmUnread}
        onSelectTab={selectTab}
        placement="bottom"
      />
      )}
    </div>
  );
}
