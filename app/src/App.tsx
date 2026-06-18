import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from './context/AuthContext';
import { useWebPushRegistration } from './hooks/useWebPushRegistration';
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
import { AdminHeaderButton } from './components/AdminHeaderButton';
import { PrivacyVisibilityMenu } from './components/PrivacyVisibilityMenu';
import { useDmUnread } from './context/DmUnreadContext';
import { ProfileSearchBar } from './components/ProfileSearchBar';
import { MainTabNav } from './components/MainTabNav';
import { PlatformConnectPrompt } from './components/PlatformConnectPrompt';
import { APP_LAYOUT_CHANGED_EVENT, getAppLayout, isAppa2Layout } from './lib/appLayout';
import { SalonReturnBar } from './components/SalonReturnBar';
import { UserAvatarOnline } from './components/UserAvatarOnline';
import { resolveAvatarUrl } from './lib/profilePhotos';
import { isMsdevEnvironment } from './lib/liveCameraSupport';
import { api } from './lib/api';
import {
  clearPersistedSalonSession,
  readPersistedSalonSession,
  writePersistedSalonSession,
  type ActiveSalonSession,
} from './lib/activeSalonSession';
import { dispatchPlatformStatusRefresh } from './lib/platformStatusEvents';
import {
  emitLeaveSalon,
  useSalonSocketMembership,
  type SalonForcedEndReason,
} from './hooks/useSalonSocketMembership';
import type { NearbyPerson } from './types';

// Heavy pages are lazy-loaded to defer bundle parsing of Leaflet, react-globe.gl,
// and other large media deps until the user first visits each tab.
const DmPage = lazy(() => import('./pages/DmPage').then((m) => ({ default: m.DmPage })));
const ActualiteTabPage = lazy(() => import('./pages/ActualiteTabPage').then((m) => ({ default: m.ActualiteTabPage })));
const LivePage = lazy(() => import('./pages/LivePage').then((m) => ({ default: m.LivePage })));
const SalonPage = lazy(() => import('./pages/SalonPage').then((m) => ({ default: m.SalonPage })));
const UserProfilePage = lazy(() => import('./pages/UserProfilePage').then((m) => ({ default: m.UserProfilePage })));
const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const LivesTabPage = lazy(() => import('./pages/LivesTabPage').then((m) => ({ default: m.LivesTabPage })));
const ReelsTabPage = lazy(() => import('./pages/ReelsTabPage').then((m) => ({ default: m.ReelsTabPage })));
const AdminPage = lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })));

function PageFallback() {
  return (
    <div className="flex flex-col flex-1 min-h-0 items-center justify-center gap-3 bg-[#0b0b0f] text-gray-400">
      <span className="w-7 h-7 border-2 border-purple-500/30 border-t-purple-400 rounded-full animate-spin" />
    </div>
  );
}

type Tab = 'actualite' | 'map' | 'live' | 'dm' | 'reels';
type View =
  | { type: 'home' }
  | { type: 'salon'; id: string }
  | { type: 'live'; id: string }
  | { type: 'profile'; id: string };

export default function App() {
  const { t } = useTranslation();
  const { user, token, completeOnboarding, refreshUser, authBootError, clearAuthBootError, setUserFromProfile } = useAuth();
  useWebPushRegistration(token);
  const { unreadCount: dmUnread, incomingToast, dismissToast, setDmTabActive } = useDmUnread();
  const [tab, setTab] = useState<Tab>('actualite');
  const tabRef = useRef<Tab>('actualite');
  tabRef.current = tab;
  const [view, setView] = useState<View>({ type: 'home' });
  const viewRef = useRef<View>({ type: 'home' });
  viewRef.current = view;
  const [profileOpen, setProfileOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminInitialTab, setAdminInitialTab] = useState<
    'accounts' | 'access' | 'content' | 'analytics' | 'costs' | 'support' | 'sponsors' | 'reports'
  >('accounts');
  const [adminHighlightSupportMessageId, setAdminHighlightSupportMessageId] = useState<string | undefined>();
  const [profileOpenContact, setProfileOpenContact] = useState(false);
  const [profileHighlightSupportMessageId, setProfileHighlightSupportMessageId] = useState<
    string | undefined
  >(undefined);
  const [profileOpenRecorder, setProfileOpenRecorder] = useState(false);
  const [profilePreview, setProfilePreview] = useState<NearbyPerson | null>(null);
  const [profileReturnView, setProfileReturnView] = useState<View>({ type: 'home' });
  const profileReturnViewRef = useRef<View>({ type: 'home' });
  profileReturnViewRef.current = profileReturnView;
  /** Incrémenté à chaque ouverture profil carte → chat salon replié à nouveau. */
  const [reelsInitialId, setReelsInitialId] = useState<string | undefined>();
  const salonDeepLinkHandled = useRef(false);
  const profileDeepLinkHandled = useRef(false);
  const [appLayout, setAppLayoutState] = useState(getAppLayout);
  const [dmPeerToOpen, setDmPeerToOpen] = useState<string | null>(null);
  const [dmGroupToOpen, setDmGroupToOpen] = useState<string | null>(null);
  const [msdevRebuilding, setMsdevRebuilding] = useState(false);
  const [msdevRebuildError, setMsdevRebuildError] = useState<string | null>(null);
  /** Après réduction du grand salon : rouvrir la fiche carte sur l'onglet Carte. */
  const [restoreSalonOnMapId, setRestoreSalonOnMapId] = useState<string | null>(null);
  /** Publication du fil à mettre en avant (depuis la carte). */
  const [focusFeedPostId, setFocusFeedPostId] = useState<string | null>(null);
  /** Salon ouvert (grand écran ou minimisé) — persiste hors vue salon pour la barre retour. */
  const [activeSalonSession, setActiveSalonSession] = useState<ActiveSalonSession | null>(
    () => readPersistedSalonSession()
  );
  const activeSalonSessionRef = useRef<ActiveSalonSession | null>(activeSalonSession);
  activeSalonSessionRef.current = activeSalonSession;
  /** Salon actif sur la fiche carte (petit salon) — sync session, pas masquage barre retour. */
  const [, setMapSalonActiveId] = useState<string | null>(null);

  useEffect(() => {
    writePersistedSalonSession(activeSalonSession);
  }, [activeSalonSession]);

  useEffect(() => {
    if (token !== null) return;
    clearPersistedSalonSession();
    setActiveSalonSession(null);
    setRestoreSalonOnMapId(null);
    setMapSalonActiveId(null);
  }, [token]);

  const salonRestoredOnBootRef = useRef(false);
  useEffect(() => {
    if (!user || !token || !activeSalonSession || salonRestoredOnBootRef.current) return;
    salonRestoredOnBootRef.current = true;
    if (activeSalonSession.viewMode === 'full') {
      syncSalonUrlInBar(activeSalonSession.id);
      if (viewRef.current.type === 'salon') {
        setView({ type: 'home' });
      }
      return;
    }
    if (viewRef.current.type !== 'home') return;
    setTab('map');
    setRestoreSalonOnMapId(activeSalonSession.id);
  }, [user, token, activeSalonSession]);

  const handleMsdevRebuild = useCallback(async () => {
    if (!token || msdevRebuilding) return;
    setMsdevRebuilding(true);
    setMsdevRebuildError(null);
    try {
      await api.msdevRebuild(token);
      window.location.reload();
    } catch (e) {
      setMsdevRebuildError(e instanceof Error ? e.message : 'Échec du rebuild');
      setMsdevRebuilding(false);
    }
  }, [token, msdevRebuilding]);

  useEffect(() => {
    const sync = () => setAppLayoutState(getAppLayout());
    window.addEventListener(APP_LAYOUT_CHANGED_EVENT, sync);
    return () => window.removeEventListener(APP_LAYOUT_CHANGED_EVENT, sync);
  }, []);

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
    setActiveSalonSession({ id: salonId, viewMode: 'full' });
    setView({ type: 'home' });
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
    if (oauth === 'ok' && token) {
      void refreshUser().then(() => dispatchPlatformStatusRefresh());
    }
    if (oauth === 'error') {
      const reason = params.get('reason');
      if (reason === 'not_configured') {
        alert('Connexion YouTube indisponible : OAuth Google non configuré sur le serveur.');
      } else {
        alert('Connexion YouTube annulée ou échouée.');
      }
    }
    params.delete('youtube_oauth');
    params.delete('reason');
    const q = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${q ? `?${q}` : ''}`);
  }, [token, refreshUser]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauth = params.get('spotify_oauth');
    if (!oauth) return;
    if (oauth === 'ok' && token) {
      void refreshUser().then(() => dispatchPlatformStatusRefresh());
    }
    if (oauth === 'error') {
      alert('Connexion Spotify annulée ou échouée.');
    }
    params.delete('spotify_oauth');
    params.delete('reason');
    const q = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${q ? `?${q}` : ''}`);
  }, [token, refreshUser]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauth = params.get('instagram_oauth');
    if (!oauth) return;
    if (oauth === 'ok' && token) {
      void refreshUser().then(() => dispatchPlatformStatusRefresh());
    }
    if (oauth === 'error') {
      const reason = params.get('reason');
      if (reason === 'not_configured') {
        alert('Connexion Instagram indisponible : OAuth Meta/Facebook non configuré sur le serveur.');
      } else if (reason === 'no_instagram_account') {
        alert(
          'Aucun compte Instagram professionnel lié à votre page Facebook. Liez un compte Instagram Business ou Creator à une page Facebook, puis réessayez.'
        );
      } else {
        alert('Connexion Instagram annulée ou échouée.');
      }
    }
    params.delete('instagram_oauth');
    params.delete('reason');
    const q = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${q ? `?${q}` : ''}`);
  }, [token, refreshUser]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stripeConnect = params.get('stripeConnect');
    if (!stripeConnect) return;
    if ((stripeConnect === 'return' || stripeConnect === 'refresh') && token) {
      void refreshUser();
      setProfileOpen(true);
    }
    params.delete('stripeConnect');
    const q = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${q ? `?${q}` : ''}`);
  }, [token, refreshUser]);

  useEffect(() => {
    const dmTabActive =
      Boolean(user && token) &&
      tab === 'dm' &&
      !profileOpen &&
      view.type === 'home' &&
      activeSalonSessionRef.current?.viewMode !== 'full';
    setDmTabActive(dmTabActive);
  }, [user, token, tab, profileOpen, view.type, setDmTabActive]);

  useEffect(() => {
    if (!profileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setProfileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [profileOpen]);

  useEffect(() => {
    if (!adminOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAdminOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [adminOpen]);

  const openReelInTab = useCallback((reelId: string) => {
    setProfileOpen(false);
    setReelsInitialId(reelId);
    setTab('reels');
    setView({ type: 'home' });
  }, []);

  const openOwnProfileRecorder = useCallback(() => {
    setProfileOpenRecorder(true);
    setProfileOpen(true);
  }, []);

  const clearReelsIntent = useCallback(() => {
    setReelsInitialId(undefined);
  }, []);

  const openProfile = useCallback((userId: string, preview?: NearbyPerson) => {
    setProfileReturnView(viewRef.current);
    setProfilePreview(preview ?? null);
    setProfileOpen(false);
    setView({ type: 'profile', id: userId });
    syncProfileUrlInBar(userId);
  }, []);

  const closeProfile = useCallback(() => {
    setView(profileReturnViewRef.current);
    setProfilePreview(null);
    if (parseProfileIdFromLocation()) {
      clearProfileUrlFromBar();
    }
  }, []);

  const closeActiveSalonSession = useCallback(() => {
    clearPersistedSalonSession();
    setActiveSalonSession(null);
    setRestoreSalonOnMapId(null);
    setMapSalonActiveId(null);
  }, []);

  const leaveActiveSalonSession = useCallback(() => {
    const salonId = activeSalonSessionRef.current?.id;
    if (salonId) emitLeaveSalon(salonId);
    clearSalonUrlFromBar();
    closeActiveSalonSession();
    setView({ type: 'home' });
    setTab('map');
  }, [closeActiveSalonSession]);

  const handleSalonForcedEnd = useCallback(
    (_reason: SalonForcedEndReason) => {
      const salonId = activeSalonSessionRef.current?.id;
      if (salonId) emitLeaveSalon(salonId);
      clearSalonUrlFromBar();
      closeActiveSalonSession();
      setView({ type: 'home' });
      setTab('map');
    },
    [closeActiveSalonSession]
  );

  useSalonSocketMembership(
    activeSalonSession?.id ?? null,
    user ? { id: user.id, username: user.username } : null,
    handleSalonForcedEnd
  );

  const openSalonPage = useCallback((salonId: string, salonTitle?: string) => {
    setRestoreSalonOnMapId(null);
    setProfileOpen(false);
    setProfilePreview(null);
    if (viewRef.current.type === 'profile' && parseProfileIdFromLocation()) {
      clearProfileUrlFromBar();
    }
    setActiveSalonSession((prev) => ({
      id: salonId,
      title: salonTitle ?? (prev?.id === salonId ? prev.title : undefined),
      viewMode: 'full',
    }));
    if (viewRef.current.type === 'salon') {
      setView({ type: 'home' });
    }
    syncSalonUrlInBar(salonId);
  }, []);

  const minimizeSalonToMap = useCallback((salonId: string, salonTitle?: string) => {
    clearSalonUrlFromBar();
    setRestoreSalonOnMapId(salonId);
    setActiveSalonSession((prev) => ({
      id: salonId,
      title: salonTitle ?? (prev?.id === salonId ? prev.title : undefined),
      viewMode: 'minimized',
    }));
    setProfileOpen(false);
    setProfilePreview(null);
    setView({ type: 'home' });
    setTab('map');
  }, []);

  const handleSalonPageBack = useCallback(() => {
    const session = activeSalonSessionRef.current;
    if (!session) return;
    minimizeSalonToMap(session.id, session.title);
  }, [minimizeSalonToMap]);

  const handleSalonMinimizeToMap = useCallback((title?: string) => {
    const session = activeSalonSessionRef.current;
    if (!session) return;
    minimizeSalonToMap(session.id, title ?? session.title);
  }, [minimizeSalonToMap]);

  const openAdminPanel = useCallback(
    (options?: { tab?: 'accounts' | 'access' | 'content' | 'analytics' | 'costs' | 'support' | 'sponsors' | 'reports'; supportMessageId?: string }) => {
      const session = activeSalonSessionRef.current;
      if (session?.viewMode === 'full') {
        setActiveSalonSession((prev) => (prev ? { ...prev, viewMode: 'minimized' } : prev));
      }
      setAdminInitialTab(options?.tab ?? 'accounts');
      setAdminHighlightSupportMessageId(options?.supportMessageId);
      setAdminOpen(true);
    },
    []
  );

  /** Titre chargé — ne pas forcer viewMode (évite de ré-ouvrir le plein écran après réduction). */
  const handleSalonTitleLoaded = useCallback((title?: string) => {
    setActiveSalonSession((prev) => {
      if (!prev) return prev;
      return { ...prev, title: title ?? prev.title };
    });
  }, []);

  const handleMapSalonActive = useCallback((session: ActiveSalonSession | null) => {
    setMapSalonActiveId(session?.id ?? null);
    if (session) {
      setActiveSalonSession((prev) =>
        prev?.id === session.id
          ? {
              id: session.id,
              title: session.title ?? prev.title,
              viewMode: prev?.viewMode === 'full' ? 'full' : (prev?.viewMode ?? 'minimized'),
            }
          : { id: session.id, title: session.title, viewMode: 'minimized' }
      );
    }
  }, []);

  const openProfileFromPerson = useCallback((person: NearbyPerson) => {
    openProfile(person.id, person);
  }, [openProfile]);

  const openProfileFromDm = useCallback((id: string) => {
    setDmPeerToOpen(id);
    setTab('dm');
    openProfile(id);
  }, [openProfile]);

  const consumeDmPeer = useCallback(() => setDmPeerToOpen(null), []);
  const consumeDmGroup = useCallback(() => setDmGroupToOpen(null), []);

  const stopReelsMedia = useCallback(() => {
    pauseAllReelsMediaInDom({ resetPosition: true });
  }, []);

  const openOwnProfile = useCallback(() => {
    if (tabRef.current === 'reels') stopReelsMedia();
    setProfileOpen(true);
  }, [stopReelsMedia]);

  const handleSearchSelectUser = useCallback((id: string, preview?: NearbyPerson) => openProfile(id, preview), [openProfile]);

  const openLive = useCallback((id: string) => {
    if (tabRef.current === 'reels') pauseAllReelsMediaInDom({ resetPosition: true });
    pauseMediaElements(document, { exceptLiveStage: true });
    setProfileOpen(false);
    setTab('live');
    setView({ type: 'live', id });
  }, []);

  const closeLive = useCallback(() => {
    setView({ type: 'home' });
    setTab('live');
  }, []);

  const openFeedPostFromMap = useCallback((postId: string) => {
    setFocusFeedPostId(postId);
    setTab('actualite');
    setView({ type: 'home' });
  }, []);

  const openDmWithUser = useCallback((userId: string) => {
    if (tabRef.current === 'reels') pauseAllReelsMediaInDom({ resetPosition: true });
    pauseMediaElements();
    setProfileOpen(false);
    setProfilePreview(null);
    setView({ type: 'home' });
    setDmGroupToOpen(null);
    setDmPeerToOpen(userId);
    setTab('dm');
    dismissToast();
  }, [dismissToast]);

  const openGroupChat = useCallback((groupId: string) => {
    if (tabRef.current === 'reels') pauseAllReelsMediaInDom({ resetPosition: true });
    pauseMediaElements();
    setProfileOpen(false);
    setProfilePreview(null);
    setView({ type: 'home' });
    setDmPeerToOpen(null);
    setDmGroupToOpen(groupId);
    setTab('dm');
    dismissToast();
  }, [dismissToast]);

  const selectTab = useCallback((id: Tab) => {
    if (tabRef.current === 'reels' && id !== 'reels') pauseAllReelsMediaInDom({ resetPosition: true });
    if (id !== 'reels') pauseMediaElements(document, { exceptLiveStage: true });
    setProfileOpen(false);
    setAdminOpen(false);
    const session = activeSalonSessionRef.current;
    const persistedSalonId = session?.id;
    const salonFullScreen = session?.viewMode === 'full';
    if (salonFullScreen && persistedSalonId) {
      if (id === 'map') {
        minimizeSalonToMap(persistedSalonId, session.title);
      } else {
        clearSalonUrlFromBar();
        setActiveSalonSession((prev) =>
          prev?.id === persistedSalonId
            ? { ...prev, viewMode: 'minimized' }
            : prev
        );
        setView({ type: 'home' });
      }
    } else {
      setView({ type: 'home' });
      if (id === 'map' && persistedSalonId) {
        setRestoreSalonOnMapId(persistedSalonId);
      }
    }
    setTab(id);
  }, [minimizeSalonToMap]);

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

  const salonFullScreen = activeSalonSession?.viewMode === 'full';
  /** Onglets montés sous le grand salon (overlay) ou en navigation normale. */
  const tabContentBase = view.type === 'home' || salonFullScreen;
  const reelsActive = tab === 'reels' && !profileOpen && tabContentBase;
  /** Carte visible : lecture petit salon même si overlay « Mon profil » ouvert. */
  const mapPlaybackActive = tab === 'map' && view.type === 'home' && !salonFullScreen;
  /** Montage conditionnel : un seul onglet à la fois (perf). Carte reste montée sous overlay profil (audio salon). */
  const actualiteTabMounted = tab === 'actualite' && tabContentBase && !profileOpen;
  /** Carte aussi montée (masquée) sous SalonPage, profil carte, ou autre onglet si session active. */
  const mapTabMounted =
    (tab === 'map' && (tabContentBase || view.type === 'profile')) || Boolean(activeSalonSession);
  const mapTabHiddenUnderSalon = tab === 'map' && salonFullScreen;
  const mapTabHiddenUnderProfile = tab === 'map' && view.type === 'profile';
  const mapTabHiddenOffTab = Boolean(activeSalonSession) && tab !== 'map';
  const liveTabMounted = tab === 'live' && tabContentBase;
  const dmTabMounted = tab === 'dm' && tabContentBase && !profileOpen;
  const reelsTabMounted = tab === 'reels' && tabContentBase && !profileOpen;
  const appa2 = isAppa2Layout(appLayout);
  const liveViewActive = tab === 'live' || view.type === 'live';
  const showSalonReturnBar = Boolean(activeSalonSession && !salonFullScreen);

  return (
    <div
      className={`ms-app-shell flex flex-col min-h-dvh max-h-dvh overflow-hidden min-w-0 w-full${!appa2 ? ' ms-app-shell--bottom-tabs' : ''}${appa2 && !profileOpen ? ' ms-app-shell--header-tabs' : ''}${showSalonReturnBar ? ' ms-app-shell--salon-return' : ''}`}
    >
      {incomingToast && (
        <button
          type="button"
          onClick={() =>
            incomingToast.groupId
              ? openGroupChat(incomingToast.groupId)
              : openDmWithUser(incomingToast.senderId)
          }
          className="fixed top-[calc(env(safe-area-inset-top)+3.5rem)] left-3 right-3 z-50 mx-auto max-w-md rounded-xl border border-purple-500/40 bg-[#1a1a28] px-4 py-3 shadow-lg flex items-start gap-3 text-left w-[calc(100%-1.5rem)] active:scale-[0.99]"
          role="status"
        >
          <span className="text-xl shrink-0" aria-hidden>
            ðŸ’¬
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{incomingToast.senderName}</p>
            <p className="text-xs text-gray-400 line-clamp-2">{incomingToast.preview}</p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              dismissToast();
            }}
            className="text-gray-500 hover:text-white text-lg leading-none shrink-0 cursor-pointer bg-transparent border-0 p-0"
            aria-label="Fermer la notification"
          >
            ×
          </button>
        </button>
      )}

      <header
        className={`ms-app-header${appa2 && !profileOpen ? ' ms-app-header--with-tabs' : ''}`}
      >
          <div className="px-3 sm:px-4 pb-2 ms-safe-area-top">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-1.5 sm:gap-x-2 min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 justify-self-start min-w-0 overflow-hidden">
              <button
                type="button"
                onClick={() => selectTab('actualite')}
                className="text-lg font-extrabold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent shrink-0 cursor-pointer hover:opacity-75 active:scale-95 transition"
                title={t('nav.home')}
                aria-label={t('nav.home')}
              >
                {t('app.name')}
              </button>
              {isMsdevEnvironment() && (
                <button
                  type="button"
                  onClick={() => void handleMsdevRebuild()}
                  disabled={msdevRebuilding}
                  title="Rebuild frontend + recharger (msdev)"
                  className="text-[10px] px-2 py-0.5 rounded-full border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 disabled:opacity-50 shrink-0 cursor-pointer bg-transparent max-sm:hidden"
                >
                  {msdevRebuilding ? '⏳ Build…' : '🔄 Rafraîchir'}
                </button>
              )}
            </div>
            <ProfileSearchBar
              token={token}
              onSelectUser={handleSearchSelectUser}
              className="justify-self-center w-[min(18rem,calc(100vw-7.5rem))] sm:w-[min(22rem,calc(100vw-9rem))]"
            />
            <div className="flex items-center gap-1 justify-self-end shrink-0">
              <AdminHeaderButton
                onClick={() => openAdminPanel()}
                active={adminOpen}
              />
              <PrivacyVisibilityMenu />
              <NotificationBell
                onOpenLive={openLive}
                onOpenProfile={openProfile}
                onOpenSalon={openSalonPage}
                onOpenDm={openDmWithUser}
                onOpenGroup={openGroupChat}
                onOpenAdminSupport={(supportMessageId) => {
                  openAdminPanel({ tab: 'support', supportMessageId });
                }}
                onOpenContactSupport={(supportMessageId) => {
                  setProfileHighlightSupportMessageId(supportMessageId);
                  setProfileOpenContact(true);
                  setProfileOpen(true);
                }}
              />
              <button
                type="button"
                onClick={openOwnProfile}
                className="rounded-full ring-2 ring-purple-500/40 hover:ring-purple-400 active:scale-95 transition"
                title="Mon profil"
                aria-label="Ouvrir mon profil"
              >
                <UserAvatarOnline
                  userId={user.id}
                  username={user.username}
                  avatarUrl={resolveAvatarUrl(user)}
                  size="xs"
                />
              </button>
            </div>
          </div>
        </div>
        {showSalonReturnBar && activeSalonSession && (
          <SalonReturnBar
            salonTitle={activeSalonSession.title}
            onReturn={() => openSalonPage(activeSalonSession.id, activeSalonSession.title)}
          />
        )}
        {msdevRebuildError && (
          <p className="px-4 pb-1 text-[10px] text-red-400 text-center" role="alert">
            {msdevRebuildError}
          </p>
        )}
        {appa2 && !profileOpen && (
          <MainTabNav
            tab={tab}
            liveViewActive={liveViewActive}
            dmUnread={dmUnread}
            onSelectTab={selectTab}
            placement="header"
          />
        )}
      </header>

      <main
        className="ms-app-main flex-1 min-h-0 min-w-0 w-full overflow-hidden flex flex-col relative"
      >
            {user && token && user.onboardingCompleted && view.type === 'home' && !profileOpen && !salonFullScreen && (
              <PlatformConnectPrompt
                token={token}
                user={user}
                onUserUpdated={setUserFromProfile}
                onOpenProfile={() => setProfileOpen(true)}
              />
            )}
            {salonFullScreen && activeSalonSession && (
              <div className="ms-salon-fullscreen-overlay flex flex-col min-h-0 bg-[#0b0b0f]">
                <Suspense fallback={<PageFallback />}>
                  <SalonPage
                    salonId={activeSalonSession.id}
                    onBack={handleSalonPageBack}
                    onLeaveSalon={leaveActiveSalonSession}
                    onMinimizeToMap={handleSalonMinimizeToMap}
                    onSalonLoaded={handleSalonTitleLoaded}
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
                  onOpenDm={(peerId) => {
                    closeProfile();
                    openDmWithUser(peerId);
                  }}
                  onOpenLive={(liveId) => {
                    clearProfileUrlFromBar();
                    setProfilePreview(null);
                    setTab('live');
                    setView({ type: 'live', id: liveId });
                  }}
                />
              </Suspense>
            )}
            {view.type === 'live' && (
              <div className="ms-salon-fullscreen-overlay flex flex-col min-h-0 bg-[#0b0b0f]">
                <Suspense fallback={<PageFallback />}>
                  <LivePage
                    liveId={view.id}
                    onBack={closeLive}
                    onOpenProfile={(id) => openProfile(id)}
                  />
                </Suspense>
              </div>
            )}
            {actualiteTabMounted && (
              <Suspense fallback={<PageFallback />}>
                <ActualiteTabPage
                  onOpenProfile={openProfile}
                  onOpenReel={openReelInTab}
                  onOpenSalon={openSalonPage}
                  onOpenLive={openLive}
                  isActive
                  focusPostId={focusFeedPostId}
                  onFocusPostConsumed={() => setFocusFeedPostId(null)}
                />
              </Suspense>
            )}
            {mapTabMounted && (
              <Suspense fallback={<PageFallback />}>
                <div
                  className={
                    mapTabHiddenUnderSalon || mapTabHiddenUnderProfile || mapTabHiddenOffTab
                      ? 'hidden'
                      : 'flex flex-col flex-1 min-h-0 min-w-0'
                  }
                >
                  <HomePage
                    appLayout={appLayout}
                    onOpenSalon={openSalonPage}
                    onOpenLive={openLive}
                    onOpenProfile={openProfileFromPerson}
                    onOpenReel={openReelInTab}
                    onOpenFeedPost={openFeedPostFromMap}
                    onCloseMapProfile={closeProfile}
                    mapPlaybackActive={mapPlaybackActive}
                    isActive={tab === 'map' && !profileOpen && view.type === 'home'}
                    activeSalonSessionId={activeSalonSession?.id ?? null}
                    restoreSalonId={restoreSalonOnMapId}
                    onSalonMapRestored={() => setRestoreSalonOnMapId(null)}
                    onMapSalonActive={handleMapSalonActive}
                    onLeaveSalon={leaveActiveSalonSession}
                    onSalonRestoreFailed={() => handleSalonForcedEnd('ended')}
                  />
                </div>
              </Suspense>
            )}
            {liveTabMounted && (
              <Suspense fallback={<PageFallback />}>
                <LivesTabPage onOpenLive={openLive} isActive />
              </Suspense>
            )}
            {dmTabMounted && (
              <Suspense fallback={<PageFallback />}>
                <DmPage
                  openPeerId={dmPeerToOpen}
                  openGroupId={dmGroupToOpen}
                  onOpenPeerConsumed={consumeDmPeer}
                  onOpenGroupConsumed={consumeDmGroup}
                  onOpenProfile={openProfileFromDm}
                  onOpenSalon={openSalonPage}
                  onOpenFeedPost={openFeedPostFromMap}
                  isActive
                />
              </Suspense>
            )}
            {reelsTabMounted && (
              <Suspense fallback={<PageFallback />}>
                <ReelsTabPage
                  onOpenLive={openLive}
                  onOpenProfile={openProfile}
                  initialReelId={reelsInitialId}
                  onIntentHandled={clearReelsIntent}
                  isActive={reelsActive}
                />
              </Suspense>
            )}

        {profileOpen && (
          <div className="ms-app-profile-overlay flex flex-col min-h-0 bg-[#0b0b0f]">
            <Suspense fallback={<PageFallback />}>
              <ProfilePage
                onBack={() => {
                  setProfileOpen(false);
                  setProfileOpenContact(false);
                  setProfileHighlightSupportMessageId(undefined);
                }}
                onOpenReel={openReelInTab}
                onOpenLive={openLive}
                onOpenProfile={openProfile}
                onOpenSalon={openSalonPage}
                openRecorderOnMount={profileOpenRecorder}
                onRecorderMountHandled={() => setProfileOpenRecorder(false)}
                openContactOnMount={profileOpenContact}
                onContactMountHandled={() => {
                  setProfileOpenContact(false);
                  setProfileHighlightSupportMessageId(undefined);
                }}
                highlightSupportMessageId={profileHighlightSupportMessageId}
              />
            </Suspense>
          </div>
        )}

        {adminOpen && (
          <div className="ms-app-profile-overlay ms-app-admin-overlay flex flex-col min-h-0 bg-[#0b0b0f]">
            <Suspense fallback={<PageFallback />}>
              <AdminPage
                initialTab={adminInitialTab}
                highlightSupportMessageId={adminHighlightSupportMessageId}
                onBack={() => {
                  setAdminOpen(false);
                  setAdminInitialTab('accounts');
                  setAdminHighlightSupportMessageId(undefined);
                }}
                onOpenSalon={(salonId, salonTitle) => {
                  setAdminOpen(false);
                  setAdminInitialTab('accounts');
                  setAdminHighlightSupportMessageId(undefined);
                  openSalonPage(salonId, salonTitle);
                }}
              />
            </Suspense>
          </div>
        )}

      </main>

      {!appa2 && (
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
