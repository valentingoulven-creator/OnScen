import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three';
import { CAMERA_DEFAULT_DISTANCE } from '../../constants';
import { GlobeScene, type GlobeSceneProps } from './GlobeScene';

/**
 * Racine du rendu 3D : configure la caméra, le tone mapping (rendu réaliste),
 * l'éclairage "soleil + ambiance spatiale", et délègue le reste à `GlobeScene`.
 * `Suspense` couvre le chargement asynchrone des textures (utilisées via `useTexture`).
 */
export function GlobeCanvas(props: GlobeSceneProps) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0, CAMERA_DEFAULT_DISTANCE], fov: 45, near: 0.01, far: 1000 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMapping = ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.15;
        gl.outputColorSpace = SRGBColorSpace;
      }}
    >
      {/*
        Éclairage volontairement plat / sans zone d'ombre : tous les pays doivent rester
        bien visibles quel que soit l'angle de rotation du globe. Une forte ambiance
        générale + deux lumières directionnelles opposées ("soleil" + "fill" côté nuit)
        éliminent tout hémisphère sombre, tout en gardant un léger relief (bump map) et
        un reflet doux sur les océans (carte spéculaire).
      */}
      <ambientLight intensity={1.25} color="#6b7ea0" />
      <directionalLight position={[5, 2.5, 5]} intensity={0.9} color="#fff6e8" />
      <directionalLight position={[-5, -2, -4]} intensity={0.75} color="#dce8ff" />

      <Suspense fallback={null}>
        <GlobeScene {...props} />
      </Suspense>
    </Canvas>
  );
}
