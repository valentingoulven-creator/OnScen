import { useProgress } from '@react-three/drei';

interface LoadingOverlayProps {
  countriesLoading: boolean;
}

/**
 * Écran de chargement — `useProgress` (drei) suit automatiquement toutes les
 * textures chargées via `useTexture` dans la scène (LoadingManager de Three.js),
 * combiné à l'état de chargement du GeoJSON des frontières (fetch séparé).
 */
export function LoadingOverlay({ countriesLoading }: LoadingOverlayProps) {
  const { active, progress } = useProgress();
  const visible = active || countriesLoading;

  return (
    <div className={`loading-overlay${visible ? '' : ' loading-overlay--hidden'}`} aria-hidden={!visible}>
      <div className="loading-spinner" />
      <p>Chargement du globe… {Math.round(progress)}%</p>
    </div>
  );
}
