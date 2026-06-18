import { Component, type ErrorInfo, type ReactNode } from 'react';
import { DEFAULT_CENTER } from '../lib/livesGeo';
import { isMsdevEnvironment } from '../lib/liveCameraSupport';
import { disableGlobeView, isWebGLError } from '../lib/webglSupport';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  recovering: boolean;
}

function isLatLngError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return (
    msg.includes('Invalid LatLng') ||
    msg.includes('LatLng') ||
    msg.includes('NaN') ||
    msg.toLowerCase().includes('leaflet')
  );
}

function isYouTubePlayerError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return (
    msg.toLowerCase().includes('invalid video') ||
    msg.toLowerCase().includes('video id') ||
    msg.toLowerCase().includes('youtube') ||
    msg.toLowerCase().includes('ytplayer') ||
    msg.toLowerCase().includes('yt.player')
  );
}

function isSocketAuthError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return (
    msg.includes('Socket requires authentication token') ||
    msg.toLowerCase().includes('unauthorized') ||
    msg.includes('auth_required') ||
    msg.includes('auth_invalid') ||
    msg.includes('auth_forbidden')
  );
}

function toError(err: unknown): Error {
  if (err instanceof Error) return err;
  return new Error(String(err ?? 'Unknown error'));
}

function resetMapCenter(): void {
  try {
    const key = 'melosong_lives_geo';
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const lat = Number(parsed.latitude);
      const lon = Number(parsed.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat === 0 || lon === 0) {
        localStorage.setItem(
          key,
          JSON.stringify({
            ...parsed,
            latitude: DEFAULT_CENTER[0],
            longitude: DEFAULT_CENTER[1],
            source: 'city',
            label: 'Paris, France',
          })
        );
      }
    }
  } catch {
    /* ignore */
  }
}

export class AppErrorBoundary extends Component<Props, State> {
  private autoResetTimer: ReturnType<typeof setTimeout> | null = null;

  state: State = { error: null, recovering: false };

  static getDerivedStateFromError(error: unknown): State {
    if (isSocketAuthError(error)) {
      return { error: null, recovering: true };
    }
    if (isWebGLError(error)) {
      return { error: null, recovering: true };
    }
    return { error: toError(error), recovering: false };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('[MeloSong]', error, info.componentStack);

    if (isSocketAuthError(error)) {
      this.setState({ recovering: true });
      this.autoResetTimer = setTimeout(() => {
        window.location.reload();
      }, 800);
    } else if (isLatLngError(error)) {
      resetMapCenter();
      this.setState({ recovering: true });
      this.autoResetTimer = setTimeout(() => {
        this.setState({ error: null, recovering: false });
      }, 1200);
    } else if (isYouTubePlayerError(error)) {
      this.autoResetTimer = setTimeout(() => {
        this.setState({ error: null, recovering: false });
      }, 100);
    } else if (isWebGLError(error)) {
      disableGlobeView();
      this.setState({ recovering: true });
      this.autoResetTimer = setTimeout(() => {
        this.setState({ error: null, recovering: false });
      }, 100);
    }
  }

  componentWillUnmount(): void {
    if (this.autoResetTimer) clearTimeout(this.autoResetTimer);
  }

  render() {
    const { error, recovering } = this.state;
    const showMsdevHint = isMsdevEnvironment();

    if (recovering) {
      return (
        <div className="min-h-dvh flex flex-col items-center justify-center gap-3 p-6 bg-[#0b0b0f] text-gray-400 text-center">
          <span className="w-6 h-6 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
          <p className="text-sm">Réinitialisation…</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="min-h-dvh flex flex-col items-center justify-center gap-4 p-6 bg-[#0b0b0f] text-gray-300 text-center">
          <p className="text-lg font-semibold text-red-400">Soundy — erreur de chargement</p>
          <p className="text-sm text-gray-500 max-w-md">{error.message}</p>
          {showMsdevHint && (
            <p className="text-xs text-gray-500 max-w-md">
              Écran noir ou page bloquée : fermez l'icône PWA, ouvrez{' '}
              <strong className="text-purple-300">https://localhost:4080</strong> ou{' '}
              <strong className="text-purple-300">http://localhost:4080</strong> dans Chrome, Edge ou Opera,
              puis <kbd className="px-1 rounded bg-[#1a1a26]">Ctrl+Shift+R</kbd>.
            </p>
          )}
          {!showMsdevHint && (
            <p className="text-xs text-gray-500 max-w-md">
              Réessayez de vous reconnecter ou actualisez la page. Si le problème persiste, déconnectez-vous puis
              reconnectez-vous.
            </p>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-purple-600/80 text-white text-sm font-semibold"
              onClick={() => {
                resetMapCenter();
                this.setState({ error: null, recovering: false });
              }}
            >
              Réinitialiser la carte
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-semibold"
              onClick={() => window.location.reload()}
            >
              Recharger
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
