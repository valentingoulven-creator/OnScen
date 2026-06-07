import { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { isOfflineDemo } from './lib/offlineDemo';
import { pauseAllReelsMediaInDom } from './lib/reelsMedia';
import { AuthPage } from './pages/AuthPage';
import { HomePage } from './pages/HomePage';
import { SalonPage } from './pages/SalonPage';
import { DmPage } from './pages/DmPage';
import { ProfilePage } from './pages/ProfilePage';
import { LivesTabPage } from './pages/LivesTabPage';
import { ReelsTabPage } from './pages/ReelsTabPage';
import { LivePage } from './pages/LivePage';
import { NotificationBell } from './components/NotificationBell';
import { PrivacyVisibilityMenu } from './components/PrivacyVisibilityMenu';

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
    return <SalonPage salonId={view.id} onBack={() => setView({ type: 'home' })} />;
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
      <header className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e2f] bg-[#12121a] z-40 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-lg font-extrabold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            MeloSong
          </span>
          <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full font-bold">
            {isOfflineDemo() ? 'DEMO' : 'msdev'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <PrivacyVisibilityMenu />
          <NotificationBell onOpenLive={openLive} />
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
      </header>

      <main className="flex-1 min-h-0 overflow-hidden flex flex-col relative">
        {view.type === 'live' && !profileOpen ? (
          <LivePage liveId={view.id} onBack={closeLive} />
        ) : (
          <>
            <div
              className={tab === 'map' ? 'flex flex-col flex-1 min-h-0 overflow-hidden' : 'hidden'}
              aria-hidden={tab !== 'map'}
            >
              <HomePage
                onOpenSalon={(id: string) => setView({ type: 'salon', id })}
                onOpenLive={openLive}
                onOpenLiveTab={() => selectTab('live')}
                onOpenReel={openReelInTab}
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
              <DmPage />
            </div>
            <div
              className={
                tab === 'reels' && view.type === 'home'
                  ? 'flex flex-col flex-1 min-h-0 w-full overflow-hidden'
                  : 'hidden'
              }
              aria-hidden={tab !== 'reels' || view.type !== 'home'}
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
            <ProfilePage onBack={() => setProfileOpen(false)} onOpenReel={openReelInTab} />
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
              className={`flex-1 py-3 text-sm font-semibold relative ${
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
                <span className="absolute top-2 right-1/4 w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              )}
              {label}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
