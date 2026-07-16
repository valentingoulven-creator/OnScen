import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import { CAMERA_FOCUS_DISTANCE } from '../constants';
import { lonLatToVector3 } from '../utils/geoMath';
import type { FocusTarget } from '../types';

const ARRIVAL_EPSILON = 0.01;

/**
 * Anime la caméra vers un point du globe (recherche ou clic sur un pays).
 * La cible caméra est placée le long de la normale (lon,lat) à une distance
 * fixe du centre : comme `OrbitControls.target` reste au centre du globe,
 * la caméra se retrouve automatiquement à regarder le pays visé.
 *
 * Retourne `cancelFlight`, à brancher sur le début d'un déplacement manuel
 * (glisser-déposer) pour ne pas lutter contre le geste de l'utilisateur.
 */
export function useCameraFlyTo(focusTarget: FocusTarget | null, onArrived: () => void) {
  const targetPositionRef = useRef<Vector3 | null>(null);
  const lastRequestIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!focusTarget || focusTarget.requestId === lastRequestIdRef.current) return;
    lastRequestIdRef.current = focusTarget.requestId;
    targetPositionRef.current = lonLatToVector3(focusTarget.lon, focusTarget.lat, CAMERA_FOCUS_DISTANCE);
  }, [focusTarget]);

  useFrame((state, delta) => {
    const target = targetPositionRef.current;
    if (!target) return;

    // Interpolation exponentielle indépendante du framerate (fluide à 30 comme à 120 FPS).
    const t = 1 - Math.pow(0.001, delta);
    state.camera.position.lerp(target, t);

    if (state.camera.position.distanceTo(target) < ARRIVAL_EPSILON) {
      targetPositionRef.current = null;
      onArrived();
    }
  });

  function cancelFlight() {
    targetPositionRef.current = null;
  }

  return { cancelFlight };
}
