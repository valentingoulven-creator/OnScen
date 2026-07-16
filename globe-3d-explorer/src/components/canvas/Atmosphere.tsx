import { useMemo } from 'react';
import { AdditiveBlending, BackSide, Color } from 'three';
import { ATMOSPHERE_RADIUS } from '../../constants';

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
    // Effet de "bord lumineux" (Fresnel) : plus la normale s'éloigne de l'axe
    // caméra, plus le halo est intense — donne l'anneau bleuté typique vu depuis l'espace.
    float rim = pow(0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
    gl_FragColor = vec4(glowColor, clamp(rim, 0.0, 1.0) * intensity);
  }
`;

interface AtmosphereProps {
  color?: string;
  intensity?: number;
}

/**
 * Halo atmosphérique : sphère légèrement plus grande que la Terre, rendue de
 * l'intérieur (`BackSide`) avec un shader Fresnel + blending additif pour un
 * dégradé lumineux doux sur le limbe, sans texture supplémentaire.
 */
export function Atmosphere({ color = '#5fb1ff', intensity = 0.9 }: AtmosphereProps) {
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
      <shaderMaterial
        args={[
          {
            uniforms,
            vertexShader: VERTEX_SHADER,
            fragmentShader: FRAGMENT_SHADER,
            transparent: true,
            blending: AdditiveBlending,
            side: BackSide,
            depthWrite: false,
          },
        ]}
      />
    </mesh>
  );
}
