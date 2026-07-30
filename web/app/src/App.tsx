import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSyncRef } from './hooks/useSyncRef';
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
import {
  consumePendingLiveJoin,
  parseLiveIdFromLocation,
  persistPendingLiveJoin,
  syncLiveUrlInBar,
  clearLiveUrlFromBar,
} from './lib/liveDeepLink';
import {
  STORY_APP_LINK_EVENT,
  type StoryAppLinkTarget,
} from './lib/storyAppLink';
import { pauseAllReelsMediaInDom } from './lib/reelsMedia';
import { pauseMediaElements } from './hooks/usePauseMediaOnPageHidden';
import {
  isForgotPasswordRoute,
  isResetPasswordRoute,
  isVerifyEmailRoute,
} from './lib/forgotPasswordRoute';
import { GenreOnboardingPrompt, shouldShowGenrePrompt } from './components/GenreOnboardingPrompt';
import { SalonPipPreviewFloat } from './components/SalonPipPreviewFloat';
const LivePipPreviewFloat = lazy(() =>
  import('./components/LivePipPreviewFloat').then((m) => ({ default: m.LivePipPreviewFloat }))
);
import { NotificationBell } from './components/NotificationBell';
import { AdminHeaderButton } from './components/AdminHeaderButton';
import { SettingsHeaderButton } from './components/SettingsHeaderButton';
import { ProfileHeaderButton } from './components/ProfileHeaderButton';
import { useDmUnread } from './context/DmUnreadContext';
import { ProfileSearchBar } from './components/ProfileSearchBar';
import type { GlobalSearchResultItem } from './lib/globalSearch';
import { nearbyPreviewFromSearchItem } from './components/ProfileSearchBar';
import { requestMapFlyToPlace } from './lib/mapSearchIntent';
import { MainTabNav } from './components/MainTabNav';
import { PlatformConnectPrompt } from './components/PlatformConnectPrompt';
import { ActiveSalonSessionBanner } from './components/ActiveSalonSessionBanner';
import { SalonYoutubeJoinModal } from './components/SalonYoutubeJoinModal';
import { ensureYoutubeLinkedToJoinSalon } from './lib/platformConnect';
import { ActiveLiveBanner } from './components/ActiveLiveBanner';
import { APP_LAYOUT_CHANGED_EVENT, getAppLayout, isAppa2Layout } from './lib/appLayout';
import { resolveAvatarUrl } from './lib/profilePhotos';
import { isMsdevEnvironment } from './lib/liveCameraSupport';
import { api } from './lib/api';
import {
  clearPersistedSalonSession,
  readPersistedSalonSession,
  writePersistedSalonSession,
  type ActiveSalonSession,
} from './lib/activeSalonSession';
import {
  clearPersistedLiveViewerSession,
  readPersistedLiveViewerSession,
  writePersistedLiveViewerSession,
  type ActiveLiveViewerSession,
} from './lib/activeLiveViewerSession';
import {
  clearOpenSalonPipIntent,
  consumeSalonOpenIntent,
  dispatchOpenSalonPip,
  dispatchSalonBeforeMinimize,
  getSalonVideoFloatActive,
  peekSalonOpenIntent,
  setOpenSalonPipIntent,
  setSalonOpenIntent,
  setSalonVideoFloatActive,
  subscribeSalonVideoFloat,
} from './lib/salonVideoFloat';
import {
  dispatchLiveBeforeMinimize,
  setLiveVideoFloatActive,
} from './lib/liveVideoFloat';
import { emitOnSocket } from './lib/socket';
import { CookieConsentBanner } from './components/CookieConsentBanner';
import { TermsReacceptanceModal } from './components/TermsReacceptanceModal';
import { dispatchPlatformStatusRefresh } from './lib/platformStatusEvents';
import {
  emitLeaveSalon,
  useSalonSocketMembership,
  type SalonForcedEndReason,
} from './hooks/useSalonSocketMembership';
import type { NearbyPerson, Salon, Live } from './types';

// Heavy pages are lazy-loaded to defer bundle parsing of Leaflet, react-globe.gl,
// and other large media deps until the user first visits each tab.
const AuthPage = lazy(() => import('./pages/AuthPage').then((m) => ({ default: m.AuthPage })));
const ForgotPasswordPage = lazy(() =>
  import('./pages/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage }))
);
const ResetPasswordPage = lazy(() =>
  import('./pages/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage }))
);
const EmailVerificationPage = lazy(() =>
  import('./pages/EmailVerificationPage').then((m) => ({ default: m.EmailVerificationPage }))
);
const OnboardingPage = lazy(() =>
  import('./pages/OnboardingPage').then((m) => ({ default: m.OnboardingPage }))
);
const RequiredPasswordChangeModal = lazy(() =>
  import('./components/RequiredPasswordChangeModal').then((m) => ({
    default: m.RequiredPasswordChangeModal,
  }))
);
const DmPage = lazy(() => import('./pages/DmPage').then((m) => ({ default: m.DmPage })));
const ActualiteTabPage = lazy(() => import('./pages/ActualiteTabPage').then((m) => ({ default: m.ActualiteTabPage })));
const LivePage = lazy(() => import('./pages/LivePage').then((m) => ({ default: m.LivePage })));
const SalonPage = lazy(() => import('./pages/SalonPage').then((m) => ({ default: m.SalonPage })));
const UserProfilePage = lazy(() => import('./pages/UserProfilePage').then((m) => ({ default: m.UserProfilePage })));
const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const ReelsTabPage = lazy(() => import('./pages/ReelsTabPage').then((m) => ({ default: m.ReelsTabPage })));
const MusicTabPage = lazy(() => import('./pages/MusicTabPage').then((m) => ({ default: m.MusicTabPage })));
const AdminPage = lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));

function PageFallback() {
  return (
    <div className="flex flex-col flex-1 min-h-0 items-center justify-center gap-3 bg-[#0b0b0f] text-gray-400">
      <span className="w-7 h-7 border-2 border-purple-500/30 border-t-purple-400 rounded-full animate-spin" />
    </div>
  );
}

type Tab = 'actualite' | 'map' | 'live' | 'dm' | 'music' | 'reels';
type View =
  | { type: 'home' }
  | { type: 'salon'; id: string }
  | { type: 'live'; id: string }
  | { type: 'profile'; id: string };

export default function App() {
  const { user, token, completeOnboarding, refreshUser, authBootPending, authBootError, clearAuthBootError, setUserFromProfile, logout } = useAuth();
  useWebPushRegistration(token);
  const { unreadCount: dmUnread, incomingToast, dismissToast, setDmTabActive } = useDmUnread();
  const [appToast, setAppToast] = useState<{ message: string; kind: 'info' | 'error' } | null>(null);
  const showAppToast = useCallback((message: string, kind: 'info' | 'error' = 'info') => {
    setAppToast({ message, kind });
    window.setTimeout(() => setAppToast(null), 5000);
  }, []);
  const [tab, setTab] = useState<Tab>('actualite');
  const tabRef = useSyncRef(tab);
  const [view, setView] = useState<View>({ type: 'home' });
  const viewRef = useSyncRef(view);
  const [profileOpen, setProfileOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
  const profileReturnViewRef = useSyncRef(profileReturnView);
  /** Incrémenté à chaque ouverture profil carte → chat salon replié à nouveau. */
  const [reelsInitialId, setReelsInitialId] = useState<string | undefined>();
  const [reelsNavigateKey, setReelsNavigateKey] = useState(0);
  const salonDeepLinkHandled = useRef(false);
  const liveDeepLinkHandled = useRef(false);
  const profileDeepLinkHandled = useRef(false);
  const [appLayout, setAppLayoutState] = useState(getAppLayout);
  const [dmPeerToOpen, setDmPeerToOpen] = useState<string | null>(null);
  const [dmGroupToOpen, setDmGroupToOpen] = useState<string | null>(null);
  const [dmSupportToOpen, setDmSupportToOpen] = useState<string | null>(null);
  const [msdevRebuilding, setMsdevRebuilding] = useState(false);
  const [msdevRebuildError, setMsdevRebuildError] = useState<string | null>(null);
  /** Après réduction du grand salon : rouvrir la fiche carte sur l'onglet Carte. */
  const [restoreSalonOnMapId, setRestoreSalonOnMapId] = useState<string | null>(null);
  /** Prévisualisation PiP sans rejoindre (clic sidebar carte). */
  const [salonPipPreview, setSalonPipPreview] = useState<Salon | null>(null);
  /** Prévisualisation live PiP sans rejoindre (clic sidebar carte / marqueur live). */
  const [livePipPreview, setLivePipPreview] = useState<Live | null>(null);
  /** Incrémenté à chaque ouverture PiP live → remount + position par défaut. */
  const [livePipOpenSeq, setLivePipOpenSeq] = useState(0);
  const [showGenrePrompt, setShowGenrePrompt] = useState(false);
  /** Publication du fil à mettre en avant (depuis la carte). */
  const [focusFeedPostId, setFocusFeedPostId] = useState<string | null>(null);
  /** Salon ouvert (grand écran ou minimisé) — persiste hors vue salon pour la barre retour. */
  const [activeSalonSession, setActiveSalonSession] = useState<ActiveSalonSession | null>(
    () => readPersistedSalonSession()
  );
  const [salonVideoFloatActive, setSalonVideoFloatActiveState] = useState(getSalonVideoFloatActive);
  const activeSalonSessionRef = useSyncRef(activeSalonSession);
  /** Live regardé ou diffusé — persiste en PiP hors page live plein écran. */
  const [activeLiveViewerSession, setActiveLiveViewerSession] =
    useState<ActiveLiveViewerSession | null>(() => readPersistedLiveViewerSession());
  const activeLiveViewerSessionRef = useSyncRef(activeLiveViewerSession);
  /** Salon actif sur la fiche carte (petit salon) — sync session, pas masquage barre retour. */
  const [, setMapSalonActiveId] = useState<string | null>(null);

  useEffect(() => {
    writePersistedSalonSession(activeSalonSession);
  }, [activeSalonSession]);

  useEffect(() => {
    writePersistedLiveViewerSession(activeLiveViewerSession);
  }, [activeLiveViewerSession]);

  useEffect(
    () =>
      subscribeSalonVideoFloat(() => {
        setSalonVideoFloatActiveState((prev) => {
          const next = getSalonVideoFloatActive();
          return prev === next ? prev : next;
        });
      }),
    []
  );

  useEffect(() => {
    if (token !== null) return;
    setSalonVideoFloatActive(false);
    setLiveVideoFloatActive(false);
    clearPersistedSalonSession();
    clearPersistedLiveViewerSession();
    setActiveSalonSession(null);
    setActiveLiveViewerSession(null);
    setRestoreSalonOnMapId(null);
    setMapSalonActiveId(null);
    setSalonPipPreview(null);
    setLivePipPreview(null);
  }, [token]);

  useEffect(() => {
    if (tab !== 'map') {
      setSalonPipPreview(null);
      setLivePipPreview(null);
    }
  }, [tab]);

  useEffect(() => {
    if (user?.onboardingCompleted && shouldShowGenrePrompt(user.favoriteGenres)) {
      setShowGenrePrompt(true);
    }
  // Run once per user session (user.id change = new login)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  /** Restaure la session hôte depuis /auth/me après rechargement (sessionStorage + API). */
  useEffect(() => {
    const hostedSalonId = user?.salonId;
    if (!hostedSalonId || !token) {
      setActiveSalonSession((prev) => {
        if (!prev?.isHost) return prev;
        return null;
      });
      return;
    }
    let cancelled = false;
    const hostedSalonTitle = user.salonTitle;
    void api
      .getSalon(token, hostedSalonId)
      .then(() => {
        if (cancelled) return;
        setActiveSalonSession((prev) => {
          if (prev?.id === hostedSalonId) {
            return {
              ...prev,
              isHost: true,
              title: prev.title ?? hostedSalonTitle,
            };
          }
          return {
            id: hostedSalonId,
            title: hostedSalonTitle,
            viewMode: prev?.viewMode === 'full' ? 'full' : 'minimized',
            isHost: true,
          };
        });
      })
      .catch(() => {
        if (cancelled) return;
        clearSalonUrlFromBar();
        clearPersistedSalonSession();
        void refreshUser();
        setActiveSalonSession((prev) => (prev?.id === hostedSalonId ? null : prev));
      });
    return () => {
      cancelled = true;
    };
  }, [user?.salonId, user?.salonTitle, token, refreshUser]);

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
  }, [user, token, activeSalonSession, viewRef]);

  const liveRestoredOnBootRef = useRef(false);
  useEffect(() => {
    if (!user || !token || !activeLiveViewerSession || liveRestoredOnBootRef.current) return;
    liveRestoredOnBootRef.current = true;
    if (activeLiveViewerSession.viewMode === 'full') {
      setView({ type: 'live', id: activeLiveViewerSession.id });
      setTab('map');
    }
  }, [user, token, activeLiveViewerSession]);

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
    const liveId = parseLiveIdFromLocation();
    if (liveId) persistPendingLiveJoin(liveId);
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

    let cancelled = false;
    void api
      .getSalon(token, salonId)
      .then(({ salon }) => {
        if (cancelled) return;
        setTab('map');
        setProfileOpen(false);
        setProfilePreview(null);
        setActiveSalonSession({
          id: salon.id,
          title: salon.title,
          viewMode: 'full',
          isHost: salon.hostId === user.id,
        });
        setView({ type: 'home' });
        syncSalonUrlInBar(salon.id);
      })
      .catch(() => {
        if (cancelled) return;
        clearSalonUrlFromBar();
        clearPersistedSalonSession();
        showAppToast('Salon inaccessible', 'error');
      });
    return () => {
      cancelled = true;
    };
  }, [user, token, showAppToast]);

  useEffect(() => {
    if (!user || !token || liveDeepLinkHandled.current) return;
    if (parseSalonIdFromLocation()) return;
    const fromUrl = parseLiveIdFromLocation();
    const pending = consumePendingLiveJoin();
    const liveId = fromUrl ?? pending;
    if (!liveId) return;
    liveDeepLinkHandled.current = true;

    setSalonVideoFloatActive(false);
    setProfileOpen(false);
    setSalonPipPreview(null);
    setLivePipPreview(null);
    setActiveLiveViewerSession({
      id: liveId,
      viewMode: 'full',
      isHost: user.isLive && user.liveId === liveId ? true : undefined,
    });
    setTab('map');
    setView({ type: 'live', id: liveId });
    syncLiveUrlInBar(liveId);
  }, [user, token]);

  useEffect(() => {
    if (!user || !token || profileDeepLinkHandled.current) return;
    if (parseSalonIdFromLocation()) return;
    if (parseLiveIdFromLocation()) return;
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
      const googleError = params.get('google_error');
      if (reason === 'not_configured') {
        showAppToast('Connexion YouTube indisponible : OAuth Google non configuré sur le serveur.', 'error');
      } else if (googleError === 'access_denied') {
        showAppToast(
          'Google refuse la connexion : l’app Soundy est encore en mode test OAuth. Demandez à l’équipe d’ajouter votre adresse Gmail comme testeur Google Cloud, ou utilisez « Connexion démo (sans Google) » dans le salon. Un compte Google Workspace n’est pas requis — un compte YouTube personnel suffit.',
          'error'
        );
      } else {
        showAppToast('Connexion YouTube annulée ou échouée.', 'error');
      }
    }
    params.delete('youtube_oauth');
    params.delete('reason');
    params.delete('google_error');
    const q = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${q ? `?${q}` : ''}`);
  }, [token, refreshUser, showAppToast]);

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
        showAppToast('Connexion Instagram indisponible : OAuth Meta/Facebook non configuré sur le serveur.', 'error');
      } else if (reason === 'no_instagram_account') {
        showAppToast(
          'Aucun compte Instagram professionnel lié à votre page Facebook. Liez un compte Instagram Business ou Creator à une page Facebook, puis réessayez.',
          'error'
        );
      } else {
        showAppToast('Connexion Instagram annulée ou échouée.', 'error');
      }
    }
    params.delete('instagram_oauth');
    params.delete('reason');
    const q = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${q ? `?${q}` : ''}`);
  }, [token, refreshUser, showAppToast]);

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
  }, [user, token, tab, profileOpen, view.type, setDmTabActive, activeSalonSessionRef]);

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

  useEffect(() => {
    if (!settingsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSettingsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [settingsOpen]);

  const openOwnProfileRecorder = useCallback(() => {
    setProfileOpenRecorder(true);
    setProfileOpen(true);
  }, []);

  const clearReelsIntent = useCallback(() => {
    setReelsInitialId(undefined);
  }, []);

  const openProfile = useCallback((userId: string, preview?: NearbyPerson) => {
    const session = activeSalonSessionRef.current;
    if (session?.viewMode === 'full') {
      dispatchSalonBeforeMinimize();
      clearSalonUrlFromBar();
      setActiveSalonSession((prev) =>
        prev?.id === session.id ? { ...prev, viewMode: 'minimized' } : prev
      );
    }
    setProfileReturnView(viewRef.current);
    setProfilePreview(preview ?? null);
    setProfileOpen(false);
    setView({ type: 'profile', id: userId });
    syncProfileUrlInBar(userId);
  }, [activeSalonSessionRef, viewRef]);

  const openStoryAppLink = useCallback(
    (target: StoryAppLinkTarget) => {
      if (target.kind === 'album' && target.albumId) {
        setProfileReturnView(viewRef.current);
        setProfilePreview(null);
        setProfileOpen(false);
        setView({ type: 'profile', id: target.userId });
        syncProfileUrlInBar(target.userId, {
          tab: 'compositions',
          album: target.albumId,
        });
        return;
      }
      if (target.kind === 'composition' && target.compositionId) {
        setProfileReturnView(viewRef.current);
        setProfilePreview(null);
        setProfileOpen(false);
        setView({ type: 'profile', id: target.userId });
        syncProfileUrlInBar(target.userId, {
          tab: 'compositions',
          track: target.compositionId,
        });
      }
    },
    [viewRef]
  );

  useEffect(() => {
    const onStoryAppLink = (event: Event) => {
      const target = (event as CustomEvent<StoryAppLinkTarget>).detail;
      if (!target?.userId) return;
      openStoryAppLink(target);
    };
    window.addEventListener(STORY_APP_LINK_EVENT, onStoryAppLink);
    return () => window.removeEventListener(STORY_APP_LINK_EVENT, onStoryAppLink);
  }, [openStoryAppLink]);

  const closeProfile = useCallback(() => {
    setView(profileReturnViewRef.current);
    setProfilePreview(null);
    if (parseProfileIdFromLocation()) {
      clearProfileUrlFromBar();
    }
  }, [profileReturnViewRef]);

  const closeActiveSalonSession = useCallback(() => {
    setSalonVideoFloatActive(false);
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
  }, [activeSalonSessionRef, closeActiveSalonSession]);

  const handleSalonForcedEnd = useCallback(
    (_reason: SalonForcedEndReason) => {
      const wasHost = activeSalonSessionRef.current?.isHost;
      const salonId = activeSalonSessionRef.current?.id;
      if (salonId) emitLeaveSalon(salonId);
      clearSalonUrlFromBar();
      closeActiveSalonSession();
      setView({ type: 'home' });
      setTab('map');
      if (wasHost) void refreshUser();
    },
    [activeSalonSessionRef, closeActiveSalonSession, refreshUser]
  );

  const handleOwnSalonEnded = useCallback(() => {
    handleSalonForcedEnd('ended');
    void refreshUser();
  }, [handleSalonForcedEnd, refreshUser]);

  useSalonSocketMembership(
    activeSalonSession?.id ?? null,
    user ? { id: user.id, username: user.username } : null,
    handleSalonForcedEnd
  );

  const openSalonPage = useCallback((salonId: string, salonTitle?: string, isHost?: boolean) => {
    if (activeLiveViewerSessionRef.current || viewRef.current.type === 'live') {
      showAppToast("Tu regardes un live. Quitte le live pour rejoindre un salon.", 'info');
      return;
    }
    if (user?.isLive && user.liveId) {
      showAppToast("Tu es déjà en live. Arrête le live pour rejoindre un salon.", 'info');
      return;
    }
    const host = isHost === true;
    if (user && !ensureYoutubeLinkedToJoinSalon(user.connectedPlatforms, host)) {
      return;
    }
    setSalonOpenIntent('full');
    clearOpenSalonPipIntent();
    setSalonVideoFloatActive(false);
    setRestoreSalonOnMapId(null);
    setSalonPipPreview(null);
    setLivePipPreview(null);
    setProfileOpen(false);
    setProfilePreview(null);
    if (viewRef.current.type === 'profile' && parseProfileIdFromLocation()) {
      clearProfileUrlFromBar();
    }
    setActiveSalonSession((prev) => ({
      id: salonId,
      title: salonTitle ?? (prev?.id === salonId ? prev.title : undefined),
      viewMode: 'full',
      isHost:
        isHost ??
        (prev?.id === salonId
          ? prev.isHost
          : user?.salonId === salonId
            ? true
            : false),
    }));
    if (viewRef.current.type === 'salon') {
      setView({ type: 'home' });
    }
    syncSalonUrlInBar(salonId);
  }, [activeLiveViewerSessionRef, showAppToast, user, viewRef]);

  /** Clic sidebar carte : aperçu YouTube sans rejoindre le salon. */
  const openSalonPipPreview = useCallback((salon: Salon) => {
    setLivePipPreview(null);
    setSalonPipPreview(salon);
  }, []);

  /** Clic sidebar carte : aperçu live sans rejoindre (HLS/WebRTC). */
  const openLivePipPreview = useCallback((live: Live) => {
    setSalonPipPreview(null);
    setLivePipPreview(live);
    setLivePipOpenSeq((n) => n + 1);
  }, []);

  const minimizeSalonToMap = useCallback((salonId: string, salonTitle?: string) => {
    dispatchSalonBeforeMinimize();
    clearSalonUrlFromBar();
    setActiveSalonSession((prev) => ({
      id: salonId,
      title: salonTitle ?? (prev?.id === salonId ? prev.title : undefined),
      viewMode: 'minimized',
      isHost: prev?.id === salonId ? prev.isHost : undefined,
    }));
    setProfileOpen(false);
    setProfilePreview(null);
    // Dismiss any floating preview PiPs when the salon is minimized.
    // The tab !== 'map' effect won't fire when the tab was already 'map' (the common
    // case: user opened the salon from the map tab), so we clear them explicitly here.
    setSalonPipPreview(null);
    setLivePipPreview(null);
    setView({ type: 'home' });
    setTab('map');
  }, []);

  /** Clic sidebar carte : salon minimisé + PiP vidéo, carte reste visible. */
  const openSalonPip = useCallback((salonId: string, salonTitle?: string, isHost?: boolean) => {
    if (activeLiveViewerSessionRef.current || viewRef.current.type === 'live') {
      showAppToast("Tu regardes un live. Quitte le live pour rejoindre un salon.", 'info');
      return;
    }
    if (user?.isLive && user.liveId) {
      showAppToast("Tu es déjà en live. Arrête le live pour rejoindre un salon.", 'info');
      return;
    }
    const host = isHost === true;
    if (user && !ensureYoutubeLinkedToJoinSalon(user.connectedPlatforms, host)) {
      return;
    }
    consumeSalonOpenIntent();
    clearSalonUrlFromBar();
    setRestoreSalonOnMapId(null);
    setProfileOpen(false);
    setProfilePreview(null);
    if (viewRef.current.type === 'profile' && parseProfileIdFromLocation()) {
      clearProfileUrlFromBar();
    }
    setActiveSalonSession((prev) => ({
      id: salonId,
      title: salonTitle ?? (prev?.id === salonId ? prev.title : undefined),
      viewMode: 'minimized',
      isHost:
        isHost ??
        (prev?.id === salonId
          ? prev.isHost
          : user?.salonId === salonId
            ? true
            : false),
    }));
    if (viewRef.current.type !== 'home') {
      setView({ type: 'home' });
    }
    setTab('map');
    setOpenSalonPipIntent(salonId);
    dispatchOpenSalonPip();
  }, [activeLiveViewerSessionRef, showAppToast, user, viewRef]);

  const handleSalonPageBack = useCallback(() => {
    const session = activeSalonSessionRef.current;
    if (!session) return;
    minimizeSalonToMap(session.id, session.title);
  }, [activeSalonSessionRef, minimizeSalonToMap]);

  const handleSalonMinimizeToMap = useCallback((title?: string) => {
    const session = activeSalonSessionRef.current;
    if (!session) return;
    minimizeSalonToMap(session.id, title ?? session.title);
  }, [activeSalonSessionRef, minimizeSalonToMap]);

  const openAdminPanel = useCallback(
    (options?: { tab?: 'accounts' | 'access' | 'content' | 'analytics' | 'costs' | 'support' | 'sponsors' | 'reports'; supportMessageId?: string }) => {
      const session = activeSalonSessionRef.current;
      if (session?.viewMode === 'full') {
        dispatchSalonBeforeMinimize();
        setActiveSalonSession((prev) => (prev ? { ...prev, viewMode: 'minimized' } : prev));
      }
      setAdminInitialTab(options?.tab ?? 'accounts');
      setAdminHighlightSupportMessageId(options?.supportMessageId);
      setSettingsOpen(false);
      setAdminOpen(true);
    },
    [activeSalonSessionRef]
  );

  const openSettingsPanel = useCallback(() => {
    const session = activeSalonSessionRef.current;
    if (session?.viewMode === 'full') {
      dispatchSalonBeforeMinimize();
      setActiveSalonSession((prev) => (prev ? { ...prev, viewMode: 'minimized' } : prev));
    }
    if (tabRef.current === 'reels') pauseAllReelsMediaInDom({ resetPosition: true });
    pauseMediaElements();
    setProfileOpen(false);
    setAdminOpen(false);
    setSettingsOpen(true);
  }, [activeSalonSessionRef, tabRef]);

  /** Titre chargé — ne pas forcer viewMode (évite de ré-ouvrir le plein écran après réduction). */
  const handleSalonTitleLoaded = useCallback((title?: string) => {
    setActiveSalonSession((prev) => {
      if (!prev) return prev;
      const nextTitle = title ?? prev.title;
      // Return same reference when nothing changed to avoid spurious App re-renders (#185)
      if (nextTitle === prev.title) return prev;
      return { ...prev, title: nextTitle };
    });
  }, []);

  const handleMapSalonActive = useCallback((session: { id: string; title?: string; isHost?: boolean } | null) => {
    setMapSalonActiveId(session?.id ?? null);
    if (session) {
      if (peekSalonOpenIntent() === 'full') {
        return;
      }
      if (activeSalonSessionRef.current && activeSalonSessionRef.current.id !== session.id) {
        setSalonVideoFloatActive(false);
      }
      setActiveSalonSession((prev) => {
        if (prev?.id === session.id) {
          const nextTitle = session.title ?? prev.title;
          const nextViewMode = prev?.viewMode === 'full' ? 'full' : (prev?.viewMode ?? 'minimized');
          const nextIsHost = session.isHost ?? prev.isHost;
          // Return same reference when nothing changed to avoid spurious App re-renders (#185)
          if (nextTitle === prev.title && nextViewMode === prev.viewMode && nextIsHost === prev.isHost) {
            return prev;
          }
          return { id: session.id, title: nextTitle, viewMode: nextViewMode, isHost: nextIsHost };
        }
        return { id: session.id, title: session.title, viewMode: 'minimized', isHost: session.isHost };
      });
    }
  }, [activeSalonSessionRef]);

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
  }, [stopReelsMedia, tabRef]);

  const openLive = useCallback((id: string) => {
    // Salon minimisé (PiP carte) ou session hôte en arrière-plan : OK pour regarder un live.
    // Bloquer seulement si le salon occupe déjà le plein écran (comme openSalonPage ↔ live).
    if (activeSalonSessionRef.current?.viewMode === 'full') {
      showAppToast("Tu es déjà dans un salon. Quitte le salon pour regarder un live.", 'info');
      return;
    }
    setSalonVideoFloatActive(false);
    const prevLive = activeLiveViewerSessionRef.current;
    if (prevLive && prevLive.id !== id) {
      emitOnSocket('leave_live', { liveId: prevLive.id });
      setLiveVideoFloatActive(false);
    }
    if (tabRef.current === 'reels') pauseAllReelsMediaInDom({ resetPosition: true });
    pauseMediaElements(document, { exceptLiveStage: true });
    setProfileOpen(false);
    setSalonPipPreview(null);
    setLivePipPreview(null);
    setActiveLiveViewerSession((prev) => ({
      id,
      title: prev?.id === id ? prev.title : undefined,
      viewMode: 'full',
      isHost: user?.isLive && user.liveId === id ? true : prev?.id === id ? prev.isHost : undefined,
    }));
    setTab('map');
    setView({ type: 'live', id });
    syncLiveUrlInBar(id);
  }, [activeLiveViewerSessionRef, activeSalonSessionRef, showAppToast, tabRef, user]);

  const closeActiveLiveViewerSession = useCallback(() => {
    setLiveVideoFloatActive(false);
    clearPersistedLiveViewerSession();
    setActiveLiveViewerSession(null);
  }, []);

  const leaveActiveLiveViewerSession = useCallback(() => {
    const liveId = activeLiveViewerSessionRef.current?.id;
    if (liveId) emitOnSocket('leave_live', { liveId });
    closeActiveLiveViewerSession();
    clearLiveUrlFromBar();
    setView({ type: 'home' });
    setTab('map');
  }, [activeLiveViewerSessionRef, closeActiveLiveViewerSession]);

  const stopActiveLiveHostSession = useCallback(async () => {
    const liveId =
      activeLiveViewerSessionRef.current?.id ??
      (user?.isLive && user.liveId ? user.liveId : null);
    if (!liveId || !token) return;
    emitOnSocket('leave_live', { liveId });
    setLiveVideoFloatActive(false);
    try {
      await api.stopLive(token);
    } finally {
      void refreshUser();
      closeActiveLiveViewerSession();
      setView({ type: 'home' });
      setTab('map');
    }
  }, [
    activeLiveViewerSessionRef,
    closeActiveLiveViewerSession,
    refreshUser,
    token,
    user?.isLive,
    user?.liveId,
  ]);

  const minimizeLiveViewer = useCallback(() => {
    dispatchLiveBeforeMinimize();
    setLiveVideoFloatActive(true);
    setProfileOpen(false);
    setProfilePreview(null);
    setLivePipPreview(null);
    clearLiveUrlFromBar();
    setActiveLiveViewerSession((prev) => (prev ? { ...prev, viewMode: 'minimized' } : prev));
    setView({ type: 'home' });
  }, []);

  /** Reprendre (bandeau / chip carte) → overlay ms-salon-fullscreen-overlay + view live. */
  const restoreLiveFullScreen = useCallback(() => {
    const session = activeLiveViewerSessionRef.current;
    if (!session) return;
    setLiveVideoFloatActive(false);
    setActiveLiveViewerSession((prev) => (prev ? { ...prev, viewMode: 'full' } : prev));
    setProfileOpen(false);
    setTab('map');
    setView({ type: 'live', id: session.id });
    syncLiveUrlInBar(session.id);
  }, [activeLiveViewerSessionRef]);

  const handleLivePageBack = useCallback(() => {
    if (!activeLiveViewerSessionRef.current) {
      setView({ type: 'home' });
      setTab('map');
      return;
    }
    minimizeLiveViewer();
  }, [activeLiveViewerSessionRef, minimizeLiveViewer]);

  const handleLiveTitleLoaded = useCallback((title?: string) => {
    setActiveLiveViewerSession((prev) => {
      if (!prev) return prev;
      const nextTitle = title ?? prev.title;
      if (nextTitle === prev.title) return prev;
      return { ...prev, title: nextTitle };
    });
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
    setDmSupportToOpen(null);
    setDmPeerToOpen(userId);
    setTab('dm');
    dismissToast();
  }, [dismissToast, tabRef]);

  const openGroupChat = useCallback((groupId: string) => {
    if (tabRef.current === 'reels') pauseAllReelsMediaInDom({ resetPosition: true });
    pauseMediaElements();
    setProfileOpen(false);
    setProfilePreview(null);
    setView({ type: 'home' });
    setDmPeerToOpen(null);
    setDmSupportToOpen(null);
    setDmGroupToOpen(groupId);
    setTab('dm');
    dismissToast();
  }, [dismissToast, tabRef]);

  const openSupportChat = useCallback((supportMessageId?: string) => {
    if (tabRef.current === 'reels') pauseAllReelsMediaInDom({ resetPosition: true });
    pauseMediaElements();
    setProfileOpen(false);
    setProfileOpenContact(false);
    setProfileHighlightSupportMessageId(undefined);
    setProfilePreview(null);
    setView({ type: 'home' });
    setDmPeerToOpen(null);
    setDmGroupToOpen(null);
    setDmSupportToOpen(supportMessageId ?? 'latest');
    setTab('dm');
    dismissToast();
  }, [dismissToast, tabRef]);

  const selectTab = useCallback((id: Tab) => {
    const nextTab = id === 'live' ? 'map' : id;
    if (id !== 'reels') pauseMediaElements(document, { exceptLiveStage: true });
    if (id !== 'reels' && tabRef.current === 'reels') pauseAllReelsMediaInDom({ resetPosition: true });
    setProfileOpen(false);
    setAdminOpen(false);
    setSettingsOpen(false);
    const liveSession = activeLiveViewerSessionRef.current;
    const liveFullScreenActive = liveSession?.viewMode === 'full';
    if (liveFullScreenActive && liveSession) {
      dispatchLiveBeforeMinimize();
      setLiveVideoFloatActive(true);
      setActiveLiveViewerSession((prev) =>
        prev?.id === liveSession.id ? { ...prev, viewMode: 'minimized' } : prev
      );
      setView({ type: 'home' });
      setTab(nextTab);
      return;
    }
    const session = activeSalonSessionRef.current;
    const persistedSalonId = session?.id;
    const salonFullScreen = session?.viewMode === 'full';
    if (salonFullScreen && persistedSalonId) {
      if (nextTab === 'map') {
        minimizeSalonToMap(persistedSalonId, session.title);
      } else {
        dispatchSalonBeforeMinimize();
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
    }
    setTab(nextTab);
  }, [activeLiveViewerSessionRef, activeSalonSessionRef, minimizeSalonToMap, tabRef]);

  const handleGlobalSearchSelect = useCallback(
    (item: GlobalSearchResultItem) => {
      switch (item.kind) {
        case 'user':
          openProfile(item.id, nearbyPreviewFromSearchItem(item));
          return;
        case 'city':
        case 'country':
          requestMapFlyToPlace({
            location: item.label,
            latitude: item.latitude,
            longitude: item.longitude,
            kind: item.kind === 'country' ? 'country' : 'city',
            nonce: Date.now(),
          });
          if (tabRef.current !== 'map') {
            selectTab('map');
          }
          return;
        case 'event':
          openFeedPostFromMap(item.id);
          return;
        case 'album':
        case 'song':
          openProfile(item.userId);
          selectTab('music');
          return;
        default:
          return;
      }
    },
    [openProfile, openFeedPostFromMap, selectTab, tabRef]
  );

  const openReelInTab = useCallback(
    (reelId: string) => {
      if (viewRef.current.type === 'profile') {
        setProfilePreview(null);
        if (parseProfileIdFromLocation()) clearProfileUrlFromBar();
      }
      setReelsInitialId(reelId);
      setReelsNavigateKey((k) => k + 1);
      selectTab('reels');
    },
    [selectTab, viewRef]
  );

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

  if (authBootPending) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-3 bg-[#0b0b0f] text-gray-400">
        <span className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-400 rounded-full animate-spin" />
        <p className="text-sm">Chargement de la session…</p>
      </div>
    );
  }

  if (!user || !token) {
    if (isForgotPasswordRoute()) {
      return (
        <>
          <Suspense fallback={<PageFallback />}>
            <ForgotPasswordPage />
          </Suspense>
          <CookieConsentBanner />
        </>
      );
    }
    if (isResetPasswordRoute()) {
      return (
        <>
          <Suspense fallback={<PageFallback />}>
            <ResetPasswordPage />
          </Suspense>
          <CookieConsentBanner />
        </>
      );
    }
    if (isVerifyEmailRoute()) {
      return (
        <>
          <Suspense fallback={<PageFallback />}>
            <EmailVerificationPage />
          </Suspense>
          <CookieConsentBanner />
        </>
      );
    }
    return (
      <>
        <Suspense fallback={<PageFallback />}>
          <AuthPage />
        </Suspense>
        <CookieConsentBanner />
      </>
    );
  }

  if (!user.onboardingCompleted) {
    return (
      <Suspense fallback={<PageFallback />}>
        <OnboardingPage onDone={completeOnboarding} />
      </Suspense>
    );
  }

  if (user.passwordChangeRequired) {
    return (
      <>
        <Suspense fallback={<PageFallback />}>
          <RequiredPasswordChangeModal
            token={token!}
            onChanged={() => void refreshUser()}
            onLogout={logout}
          />
        </Suspense>
        <CookieConsentBanner />
      </>
    );
  }

  if (user.termsReacceptanceRequired) {
    return (
      <>
        <TermsReacceptanceModal
          token={token}
          onAccepted={() => void refreshUser()}
          onLogout={logout}
        />
        <CookieConsentBanner />
      </>
    );
  }

  const salonFullScreen = activeSalonSession?.viewMode === 'full';
  const liveFullScreen = activeLiveViewerSession?.viewMode === 'full';
  const activeSalonIsHost = Boolean(
    activeSalonSession?.isHost ||
      (user?.salonId != null && user.salonId === activeSalonSession?.id)
  );
  const showActiveSalonBanner = Boolean(
    activeSalonSession && !salonFullScreen && view.type !== 'live' && token && user
  );
  const activeLiveSessionId =
    activeLiveViewerSession?.id ?? (user?.isLive && user.liveId ? user.liveId : null);
  const activeLiveIsHost = Boolean(
    activeLiveViewerSession?.isHost || (user?.isLive && user.liveId === activeLiveSessionId)
  );
  const showActiveLiveBanner = Boolean(
    activeLiveSessionId && !liveFullScreen && !salonFullScreen && token && user
  );
  const mapTabActiveForOverlay = tab === 'map' && !profileOpen && view.type === 'home';
  const showActiveSalonBannerInHeader = showActiveSalonBanner && !mapTabActiveForOverlay;
  const showActiveLiveBannerInHeader = showActiveLiveBanner && !mapTabActiveForOverlay;
  const showSalonPageShell = Boolean(
    activeSalonSession && (salonFullScreen || salonVideoFloatActive)
  );
  /** LivePage monté tant que la session live est active (PiP ou plein écran). */
  const showLivePageShell = Boolean(activeLiveViewerSession);
  /** Onglets montés sous le grand salon (overlay) ou en navigation normale. */
  const tabContentBase = view.type === 'home' || salonFullScreen;
  const reelsActive = tab === 'reels' && !profileOpen && !adminOpen && !settingsOpen && tabContentBase;
  const musicTabMounted = tab === 'music' && tabContentBase && !profileOpen;
  /** Carte visible : lecture petit salon même si overlay « Mon profil » ouvert. */
  const mapPlaybackActive = tab === 'map' && view.type === 'home' && !salonFullScreen;
  /** Montage conditionnel : un seul onglet à la fois (perf). Carte reste montée sous overlay profil (audio salon). */
  const actualiteTabMounted = tab === 'actualite' && tabContentBase && !profileOpen;
  /** Carte montée sur l'onglet Carte, profil carte, ou lecture map (petit salon). Pas en arrière-plan sur DM/Reels — évite overlays Leaflet qui figent les touches. */
  const mapTabMounted =
    (tab === 'map' && (tabContentBase || view.type === 'profile')) || mapPlaybackActive;
  const mapTabHiddenUnderSalon = tab === 'map' && salonFullScreen;
  const mapTabHiddenUnderProfile = tab === 'map' && view.type === 'profile';
  const mapTabHiddenOffTab = Boolean(activeSalonSession) && tab !== 'map';
  const liveViewActive = view.type === 'live';
  const dmTabMounted = tab === 'dm' && tabContentBase && !profileOpen;
  const reelsTabMounted = tab === 'reels' && tabContentBase;
  const reelsTabHiddenUnderOverlay = profileOpen || adminOpen || settingsOpen;
  const appa2 = isAppa2Layout(appLayout);
  const showHeaderSessionBanner = showActiveSalonBannerInHeader || showActiveLiveBannerInHeader;

  return (
    <div
      className={`ms-app-shell flex flex-col flex-1 min-h-0 h-dvh max-h-dvh min-w-0 w-full${!appa2 ? ' ms-app-shell--bottom-tabs' : ''}${appa2 && !profileOpen ? ' ms-app-shell--header-tabs' : ''}${showHeaderSessionBanner ? ' ms-app-shell--active-session-banner' : ''}`}
    >
      {incomingToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-[calc(env(safe-area-inset-top)+3.5rem)] left-3 right-3 z-50 mx-auto max-w-md rounded-xl border border-purple-500/40 bg-[#1a1a28] px-4 py-3 shadow-lg flex items-start gap-3 text-left w-[calc(100%-1.5rem)]"
        >
          <button
            type="button"
            onClick={() =>
              incomingToast.groupId
                ? openGroupChat(incomingToast.groupId)
                : openDmWithUser(incomingToast.senderId)
            }
            className="flex-1 min-w-0 flex items-start gap-3 text-left active:scale-[0.99] cursor-pointer bg-transparent border-0 p-0"
          >
            <span className="text-xl shrink-0" aria-hidden>
              💬
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{incomingToast.senderName}</p>
              <p className="text-xs text-gray-400 line-clamp-2">{incomingToast.preview}</p>
            </div>
          </button>
          <button
            type="button"
            onClick={dismissToast}
            className="text-gray-500 hover:text-white text-lg leading-none shrink-0 cursor-pointer bg-transparent border-0 p-0"
            aria-label="Fermer la notification"
          >
            ×
          </button>
        </div>
      )}

      {appToast && (
        <div
          role="alert"
          aria-live="assertive"
          className={`fixed top-[calc(env(safe-area-inset-top)+1rem)] left-3 right-3 z-[60] mx-auto max-w-md rounded-xl border px-4 py-3 shadow-lg text-sm text-center ${appToast.kind === 'error' ? 'bg-red-950/90 border-red-500/40 text-red-100' : 'bg-[#1a1a28] border-purple-500/40 text-white'}`}
        >
          <span>{appToast.message}</span>
          <button
            type="button"
            onClick={() => setAppToast(null)}
            className="ml-3 text-gray-400 hover:text-white bg-transparent border-0 p-0 leading-none cursor-pointer"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>
      )}

      <header
        className={`ms-app-header${appa2 && !profileOpen ? ' ms-app-header--with-tabs' : ''}`}
      >
          <div className="px-3 sm:px-4 pb-2 ms-safe-area-top">
          <div className="grid grid-cols-[auto_minmax(0,11rem)_auto] sm:grid-cols-[minmax(0,1fr)_minmax(0,15rem)_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)_minmax(0,1fr)] items-center gap-x-1 sm:gap-x-2 min-w-0">
            <div className="flex items-center gap-1 sm:gap-2 justify-self-start min-w-0 overflow-hidden">
              <ProfileHeaderButton
                userId={user.id}
                username={user.username}
                avatarUrl={resolveAvatarUrl(user)}
                onClick={openOwnProfile}
                active={profileOpen}
              />
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
              onSelectResult={handleGlobalSearchSelect}
              className="justify-self-center sm:justify-self-stretch w-full min-w-0"
            />
            <div className="relative z-10 flex items-center gap-0.5 sm:gap-1 justify-self-end shrink-0">
              <AdminHeaderButton
                onClick={() => openAdminPanel()}
                active={adminOpen}
              />
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
                  openSupportChat(supportMessageId);
                }}
              />
              <SettingsHeaderButton onClick={openSettingsPanel} active={settingsOpen} />
            </div>
          </div>
        </div>
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

      {showHeaderSessionBanner ? (
        <div className="ms-active-session-banner-slot">
          {showActiveSalonBannerInHeader && activeSalonSession && token && user ? (
            <ActiveSalonSessionBanner
              salonId={activeSalonSession.id}
              fallbackTitle={activeSalonSession.title}
              isHost={activeSalonSession.isHost}
              token={token}
              user={user}
              onReturn={() =>
                openSalonPage(
                  activeSalonSession.id,
                  activeSalonSession.title,
                  activeSalonIsHost
                )
              }
              onLeaveSalon={leaveActiveSalonSession}
              onSalonEnded={
                activeSalonIsHost ? handleOwnSalonEnded : () => handleSalonForcedEnd('ended')
              }
            />
          ) : null}
          {showActiveLiveBannerInHeader && activeLiveSessionId && token && user ? (
            <ActiveLiveBanner
              liveId={activeLiveSessionId}
              token={token}
              isHost={activeLiveIsHost}
              onReturn={() => {
                // Reprendre = plein écran (pas PiP). Réduction volontaire via back/minimize LivePage.
                if (activeLiveViewerSession) {
                  restoreLiveFullScreen();
                } else if (user.liveId) {
                  openLive(user.liveId);
                }
              }}
              onLeaveLive={!activeLiveIsHost ? leaveActiveLiveViewerSession : undefined}
              onStopLive={activeLiveIsHost ? stopActiveLiveHostSession : undefined}
            />
          ) : null}
        </div>
      ) : null}

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
            {showSalonPageShell && activeSalonSession && (
              <div
                className={
                  salonFullScreen
                    ? 'ms-salon-fullscreen-overlay flex flex-col flex-1 min-h-0 h-full bg-[#0b0b0f]'
                    : 'salon-page-pip-host'
                }
              >
                <Suspense fallback={<PageFallback />}>
                  <SalonPage
                    salonId={activeSalonSession.id}
                    salonFullScreen={salonFullScreen}
                    onBack={handleSalonPageBack}
                    onLeaveSalon={leaveActiveSalonSession}
                    onMinimizeToMap={handleSalonMinimizeToMap}
                    onSalonLoaded={handleSalonTitleLoaded}
                    onRestoreFullScreen={() =>
                      openSalonPage(
                        activeSalonSession.id,
                        activeSalonSession.title,
                        activeSalonSession.isHost
                      )
                    }
                    onOpenProfile={openProfile}
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
                  onOpenReel={openReelInTab}
                  onRecordReel={
                    view.id === user.id
                      ? () => {
                          closeProfile();
                          openOwnProfileRecorder();
                        }
                      : undefined
                  }
                  onSelectSalon={(salonId, salonTitle, isHost) =>
                    openSalonPage(salonId, salonTitle, isHost)
                  }
                  onOpenDm={(peerId) => {
                    closeProfile();
                    openDmWithUser(peerId);
                  }}
                  onOpenLive={(liveId) => {
                    clearProfileUrlFromBar();
                    setProfilePreview(null);
                    openLive(liveId);
                  }}
                />
              </Suspense>
            )}
            {showLivePageShell && activeLiveViewerSession && (
              <div
                className={
                  liveFullScreen
                    ? 'ms-salon-fullscreen-overlay flex flex-col flex-1 min-h-0 h-full bg-[#0b0b0f]'
                    : 'salon-page-pip-host'
                }
              >
                <Suspense fallback={<PageFallback />}>
                  <LivePage
                    liveId={activeLiveViewerSession.id}
                    liveFullScreen={liveFullScreen}
                    onBack={handleLivePageBack}
                    onMinimize={minimizeLiveViewer}
                    onLeaveLive={leaveActiveLiveViewerSession}
                    onLiveTitleLoaded={handleLiveTitleLoaded}
                    onOpenProfile={(id) => openProfile(id)}
                    onRestoreFullScreen={restoreLiveFullScreen}
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
                      ? 'hidden pointer-events-none inert'
                      : 'flex flex-col flex-1 min-h-0 min-w-0 h-full'
                  }
                  aria-hidden={
                    mapTabHiddenUnderSalon || mapTabHiddenUnderProfile || mapTabHiddenOffTab
                      ? true
                      : undefined
                  }
                >
                  <HomePage
                    appLayout={appLayout}
                    onOpenSalon={openSalonPage}
                    onOpenSalonPip={openSalonPip}
                    onOpenSalonPipPreview={openSalonPipPreview}
                    onOpenLivePipPreview={openLivePipPreview}
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
                    mapActiveSalonSession={
                      showActiveSalonBanner && activeSalonSession
                        ? {
                            id: activeSalonSession.id,
                            title: activeSalonSession.title,
                            isHost: activeSalonSession.isHost,
                          }
                        : null
                    }
                    mapActiveLiveSession={
                      showActiveLiveBanner && activeLiveSessionId
                        ? { id: activeLiveSessionId, isHost: activeLiveIsHost }
                        : null
                    }
                    onMapReturnToSalon={() => {
                      if (!activeSalonSession) return;
                      openSalonPage(
                        activeSalonSession.id,
                        activeSalonSession.title,
                        activeSalonIsHost
                      );
                    }}
                    onMapReturnToLive={() => {
                      // Même sémantique que ActiveLiveBanner « Reprendre » — plein écran.
                      if (activeLiveViewerSession) {
                        restoreLiveFullScreen();
                      } else if (user?.liveId) {
                        openLive(user.liveId);
                      }
                    }}
                  />
                </div>
              </Suspense>
            )}
            {dmTabMounted && (
              <Suspense fallback={<PageFallback />}>
                <div className="dm-tab-root flex flex-col flex-1 min-h-0 min-w-0 relative z-[2] isolate">
                  <DmPage
                    openPeerId={dmPeerToOpen}
                    openGroupId={dmGroupToOpen}
                    openSupportMessageId={dmSupportToOpen}
                    onOpenPeerConsumed={consumeDmPeer}
                    onOpenGroupConsumed={consumeDmGroup}
                    onOpenSupportConsumed={() => setDmSupportToOpen(null)}
                    onOpenProfile={openProfileFromDm}
                    onOpenSalon={openSalonPage}
                    onOpenFeedPost={openFeedPostFromMap}
                    isActive
                  />
                </div>
              </Suspense>
            )}
            {musicTabMounted && (
              <Suspense fallback={<PageFallback />}>
                <MusicTabPage
                  isActive={!profileOpen}
                  onOpenProfile={openProfile}
                />
              </Suspense>
            )}
            {reelsTabMounted && (
              <div
                className={
                  reelsTabHiddenUnderOverlay
                    ? 'hidden pointer-events-none inert'
                    : 'flex flex-col flex-1 min-h-0 min-w-0'
                }
                aria-hidden={reelsTabHiddenUnderOverlay ? true : undefined}
              >
                <Suspense fallback={<PageFallback />}>
                  <ReelsTabPage
                    navigateKey={reelsNavigateKey}
                    onOpenLive={openLive}
                    onOpenProfile={openProfile}
                    initialReelId={reelsInitialId}
                    onIntentHandled={clearReelsIntent}
                    isActive={reelsActive}
                  />
                </Suspense>
              </div>
            )}

        {profileOpen && (
          <div className="ms-app-profile-overlay flex flex-col min-h-0 bg-[#0b0b0f]">
            <Suspense fallback={<PageFallback />}>
              <ProfilePage
                onOpenReel={openReelInTab}
                onOpenLive={openLive}
                onOpenProfile={openProfile}
                onOpenSalon={openSalonPage}
                onOpenFeedPost={(post) => {
                  setFocusFeedPostId(post.id);
                  setProfileOpen(false);
                  setTab('actualite');
                  setView({ type: 'home' });
                }}
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

        {settingsOpen && (
          <div className="ms-app-profile-overlay flex flex-col min-h-0 bg-[#0b0b0f]">
            <Suspense fallback={<PageFallback />}>
              <SettingsPage onBack={() => setSettingsOpen(false)} />
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

      {showGenrePrompt && (
        <GenreOnboardingPrompt onDismiss={() => setShowGenrePrompt(false)} />
      )}

      <SalonYoutubeJoinModal token={token} user={user} onUserUpdated={setUserFromProfile} />

      {salonPipPreview && (
        <SalonPipPreviewFloat
          salon={salonPipPreview}
          onJoin={() => {
            const s = salonPipPreview;
            setSalonPipPreview(null);
            openSalonPage(s.id, s.title, s.hostId === user?.id);
          }}
          onClose={() => setSalonPipPreview(null)}
        />
      )}
      {livePipPreview && (
        <Suspense fallback={null}>
          <LivePipPreviewFloat
            key={`${livePipPreview.id}-${livePipOpenSeq}`}
            live={livePipPreview}
            onJoin={() => {
              const liveId = livePipPreview.id;
              setLivePipPreview(null);
              openLive(liveId);
            }}
            onClose={() => setLivePipPreview(null)}
          />
        </Suspense>
      )}
      <CookieConsentBanner />
    </div>
  );
}
