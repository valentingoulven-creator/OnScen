import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three';
import { CAMERA_DEFAULT_DISTANCE } from '../../lib/globe3d/constants';
import { GlobeDevDragProvider } from './DevDraggableGlobeMarker';
import { OnScenGlobeScene, type OnScenGlobeSceneProps } from './OnScenGlobeScene';

interface OnScenGlobeCanvasProps extends Omit<OnScenGlobeSceneProps, 'cameraRef'> {
  width: number;
  height: number;
  maxPixelRatio: number;
  interactionMaxPixelRatio: number;
  isInteracting: boolean;
  antialias: boolean;
  backgroundColor: string;
  onGlobeReady?: () => void;
  onGlobeUnavailable?: (err?: unknown) => void;
  cameraRef: React.RefObject<import('./GlobeCameraBridge').GlobeCameraBridgeHandle | null>;
}

export function OnScenGlobeCanvas({
  width,
  height,
  maxPixelRatio,
  interactionMaxPixelRatio,
  isInteracting,
  antialias,
  backgroundColor,
  onGlobeReady,
  onGlobeUnavailable,
  cameraRef,
  ...sceneProps
}: OnScenGlobeCanvasProps) {
  const readyRef = useRef(false);
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const [controlsEnabled, setControlsEnabled] = useState(true);

  useEffect(() => {
    const canvas = canvasElRef.current;
    if (!canvas) return;
    const onContextLost = (event: Event) => {
      // Sans preventDefault(), le navigateur ne tentera jamais de restaurer
      // le contexte WebGL (comportement par défaut : contexte mort pour de
      // bon). On l'appelle pour laisser la porte ouverte à une restauration
      // native, même si on bascule déjà sur la carte plate côté app.
      event.preventDefault();
      onGlobeUnavailable?.();
    };
    const onContextCreationError = (event: Event) => {
      onGlobeUnavailable?.((event as WebGLContextEvent).statusMessage ?? event);
    };
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextcreationerror', onContextCreationError);
    return () => {
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextcreationerror', onContextCreationError);
    };
  }, [onGlobeUnavailable]);

  const dpr = isInteracting ? interactionMaxPixelRatio : maxPixelRatio;

  return (
    <GlobeDevDragProvider
      devMarkerDragEnabled={sceneProps.devMarkerDragEnabled ?? false}
      onDevMarkerDragEnd={sceneProps.onDevMarkerDragEnd}
      setControlsEnabled={setControlsEnabled}
    >
      <Canvas
        dpr={dpr}
        style={{ width, height, touchAction: 'none' }}
        camera={{ position: [0, 0, CAMERA_DEFAULT_DISTANCE], fov: 45, near: 0.01, far: 2000 }}
        gl={{
          antialias,
          alpha: false,
          powerPreference: sceneProps.lowPower ? 'default' : 'high-performance',
          preserveDrawingBuffer: false,
        }}
        onCreated={({ gl }) => {
          canvasElRef.current = gl.domElement;
          gl.setClearColor(backgroundColor);
          gl.toneMapping = ACESFilmicToneMapping;
          gl.toneMappingExposure = sceneProps.lowPower ? 1.62 : 1.82;
          gl.outputColorSpace = SRGBColorSpace;
          if (!readyRef.current) {
            readyRef.current = true;
            onGlobeReady?.();
          }
        }}
      >
        <ambientLight intensity={1.25} color="#6b7ea0" />
        <directionalLight position={[5, 2.5, 5]} intensity={0.9} color="#fff6e8" />
        <directionalLight position={[-5, -2, -4]} intensity={0.75} color="#dce8ff" />

        <Suspense fallback={null}>
          <OnScenGlobeScene {...sceneProps} cameraRef={cameraRef} controlsEnabled={controlsEnabled} />
        </Suspense>
      </Canvas>
    </GlobeDevDragProvider>
  );
}
