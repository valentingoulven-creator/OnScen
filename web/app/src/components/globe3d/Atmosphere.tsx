import { useMemo } from 'react';
import { AdditiveBlending, BackSide, Color } from 'three';
import { ATMOSPHERE_RADIUS } from '../../lib/globe3d/constants';

const VERTEX_SHADER = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 glowColor;
  uniform float intensity;
  varying vec3 vNormal;
  void main() {
    float rim = pow(0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
    gl_FragColor = vec4(glowColor, clamp(rim, 0.0, 1.0) * intensity);
  }
`;

interface AtmosphereProps {
  color?: string;
  intensity?: number;
}

export function Atmosphere({ color = '#78b2f0', intensity = 0.55 }: AtmosphereProps) {
  const uniforms = useMemo(
    () => ({
      glowColor: { value: new Color(color) },
      intensity: { value: intensity },
    }),
    [color, intensity]
  );

  return (
    <mesh scale={[ATMOSPHERE_RADIUS, ATMOSPHERE_RADIUS, ATMOSPHERE_RADIUS]}>
      <sphereGeometry args={[1, 64, 48]} />
      {/* Props directes (pas d'objet `args` inline) : évite de recréer/recompiler
          le shaderMaterial à chaque render de la scène. */}
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
        transparent
        blending={AdditiveBlending}
        side={BackSide}
        depthWrite={false}
      />
    </mesh>
  );
}
