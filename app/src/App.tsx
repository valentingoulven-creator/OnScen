import { lazy, Suspense, useState } from 'react';
import { useAuth } from './context/AuthContext';
import { isOfflineDemo } from './lib/offlineDemo';
import { pauseAllReelsMediaInDom } from './lib/reelsMedia';
import { AuthPage } from './pages/AuthPage';
import { NotificationBell } from './components/NotificationBell';
import { PrivacyVisibilityMenu } from './components/PrivacyVisibilityMenu';
import { TabLoading } from './components/TabLoading';

const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const SalonPage = lazy(() => import('./pages/SalonPage').then((m) => ({ default: m.SalonPage })));
const DmPage = lazy(() => import('./pages/DmPage').then((m) => ({ default: m.DmPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const LivesTabPage = lazy(() => import('./pages/LivesTabPage').then((m) => ({ default: m.LivesTabPage })));
const ReelsTabPage = lazy(() => import('./pages/ReelsTabPage').then((m) => ({ default: m.ReelsTabPage })));
const LivePage = lazy(() => import('./pages/LivePage').then((m) => ({ default: m.LivePage })));

type Tab = 'map' | 'live' | 'dm' | 'reels';
type View =
  | { type: 'home' }
  | { type: 'salon'; id: string }
  | { type: 'live'; id: string };

export default function App() {
  const { user, token } = useAuth();
  const [tab, setTab] = useState<Tab>('map');
  const [view, setView] = useState<View>({ type: 'home' });
  const [profileOpen, setProfileOpen] = useState(false);
  const [reelsInitialId, setReelsInitialId] = useState<string | undefined>();
  const openReelInTab = (reelId: string) => {
    setProfileOpen(false);
    setReelsInitialId(reelId);
    setTab('reels');
    setView({ type: 'home' });
  };

  const clearReelsIntent = () => {
    setReelsInitialId(undefined);
  };

  if (!user || !token) return <AuthPage />;

  if (view.type === 'salon') {
    return (
      <Suspense fallback={<TabLoading />}>
        <SalonPage salonId={view.id} onBack={() => setView({ type: 'home' })} />
      </Suspense>
    );
  }

  const reelsActive = tab === 'reels' && !profileOpen && view.type === 'home';

  const stopReelsMedia = () => {
    pauseAllReelsMediaInDom();
  };

  const openLive = (id: string) => {
    if (tab === 'reels') stopReelsMedia();
    setProfileOpen(false);
    setTab('live');
    setView({ type: 'live', id });
  };

  const closeLive = () => {
    setView({ type: 'home' });
    setTab('live');
  };

  const selectTab = (id: Tab) => {
    if (tab === 'reels' && id !== 'reels') stopReelsMedia();
    setProfileOpen(false);
    setTab(id);
    setView({ type: 'home' });
  };

  return (
    <div className="flex flex-col min-h-dvh max-h-dvh overflow-hidden">
      <header className="flex items-center justify-between px-4 py-2.5 sm:py-3 border-b border-[#1e1e2f] bg-[#12121a] z-40 shrink-0 safe-area-pt">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base sm:text-lg font-extrabold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent truncate">
            MeloSong
          </span>
          <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full font-bold shrink-0">
            {isOfflineDemo() ? 'DEMO' : 'msdev'}
          </span>
        </div>
        <div className="flex items-center gap-0.5 sm:gap-1">
          <PrivacyVisibilityMenu />
          <NotificationBell onOpenLive={openLive} />
          <button
            type="button"
            onClick={() => {
              if (tab === 'reels') stopReelsMedia();
              setProfileOpen(true);
            }}
            className="touch-target rounded-full ring-2 ring-purple-500/40 hover:ring-purple-400 active:scale-95 transition flex items-center justify-center p-1"
            title="Mon profil"
            aria-label="Ouvrir mon profil"
          >
            <img src={user.avatarUrl} alt="" className="w-9 h-9 sm:w-8 sm:h-8 rounded-full object-cover" />
          </button>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-hidden flex flex-col relative">
        {view.type === 'live' && !profileOpen ? (
          <Suspense fallback={<TabLoading />}>
            <LivePage liveId={view.id} onBack={closeLive} />
          </Suspense>
        ) : (
          <>
            {tab === 'map' && (
              <Suspense fallback={<TabLoading />}>
                <HomePage
                  isActive
                  onOpenSalon={(id: string) => setView({ type: 'salon', id })}
                  onOpenLive={openLive}
                  onOpenLiveTab={() => selectTab('live')}
                  onOpenReel={openReelInTab}
                />
              </Suspense>
            )}
            {tab === 'live' && (
              <Suspense fallback={<TabLoading />}>
                <LivesTabPage isActive onOpenLive={openLive} />
              </Suspense>
            )}
            {tab === 'dm' && (
              <Suspense fallback={<TabLoading />}>
                <DmPage />
              </Suspense>
            )}
            {tab === 'reels' && view.type === 'home' && (
              <Suspense fallback={<TabLoading />}>
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
          <div className="absolute inset-0 z-30 flex flex-col min-h-0 bg-[#0b0b0f]">
            <Suspense fallback={<TabLoading />}>
              <ProfilePage onBack={() => setProfileOpen(false)} onOpenReel={openReelInTab} />
            </Suspense>
          </div>
        )}
      </main>

      {!profileOpen && (
        <nav className="relative z-20 shrink-0 flex border-t border-[#1e1e2f] bg-[#12121a] safe-area-pb">
          {(
            [
              ['map', 'Carte'],
              ['live', 'Live'],
              ['dm', 'Messages'],
              ['reels', 'Reels'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => selectTab(id)}
              className={`flex-1 min-h-[3rem] py-2.5 text-xs sm:text-sm font-semibold relative touch-target ${
                tab === id || (id === 'live' && view.type === 'live')
                  ? id === 'live'
                    ? 'text-red-400'
                    : id === 'reels'
                      ? 'text-pink-400'
                      : 'text-purple-400'
                  : 'text-gray-500'
              }`}
            >
              {id === 'live' && (tab === 'live' || view.type === 'live') && (
                <span className="absolute top-1.5 right-1/4 w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              )}
              {label}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
