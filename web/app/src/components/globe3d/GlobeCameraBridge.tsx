import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, type ComponentRef } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import {
  CAMERA_MAX_DISTANCE,
  CAMERA_MIN_DISTANCE,
  GLOBE_AUTO_ROTATE_BASE_SPEED,
  GLOBE_DRAG_ROTATE_BASE_SPEED,
  GLOBE_ROTATION_REF_DISTANCE,
} from '../../lib/globe3d/constants';
import {
  cameraPositionForPov,
  getPovFromCameraPosition,
} from '../../lib/globe3d/cameraMath';

export interface GlobeCameraBridgeHandle {
  getPointOfView: () => { lat: number; lng: number; altitude: number } | null;
  setAltitude: (altitude: number, durationMs?: number) => void;
  pointOfView: (lat: number, lng: number, altitude: number, durationMs?: number) => void;
}

export interface RecenterRequest {
  lat: number;
  lng: number;
  altitude: number;
  token: number;
  durationMs: number;
}

interface GlobeCameraBridgeProps {
  autoRotateEnabled?: boolean;
  controlsEnabled?: boolean;
  onInteractionStart: () => void;
  onInteractionEnd: () => void;
  onControlsChange: () => void;
  recenterRequest: RecenterRequest | null;
}

interface FlyState {
  from: Vector3;
  to: Vector3;
  startMs: number;
  durationMs: number;
}

export const GlobeCameraBridge = forwardRef<GlobeCameraBridgeHandle, GlobeCameraBridgeProps>(
  function GlobeCameraBridge(
    { autoRotateEnabled = false, controlsEnabled = true, onInteractionStart, onInteractionEnd, onControlsChange, recenterRequest },
    ref
  ) {
    const { camera } = useThree();
    const controlsRef = useRef<ComponentRef<typeof OrbitControls> | null>(null);
    const flyRef = useRef<FlyState | null>(null);
    const lastRecenterTokenRef = useRef(-1);

    const scheduleFly = useCallback((target: Vector3, durationMs: number) => {
      if (durationMs <= 0) {
        camera.position.copy(target);
        controlsRef.current?.update();
        flyRef.current = null;
        return;
      }
      flyRef.current = {
        from: camera.position.clone(),
        to: target,
        startMs: performance.now(),
        durationMs,
      };
    }, [camera]);

    useImperativeHandle(
      ref,
      () => ({
        getPointOfView() {
          try {
            return getPovFromCameraPosition(camera.position);
          } catch {
            return null;
          }
        },
        setAltitude(altitude: number, durationMs = 0) {
          const pov = getPovFromCameraPosition(camera.position);
          scheduleFly(cameraPositionForPov(pov.lat, pov.lng, altitude), durationMs);
        },
        pointOfView(lat: number, lng: number, altitude: number, durationMs = 0) {
          scheduleFly(cameraPositionForPov(lat, lng, altitude), durationMs);
        },
      }),
      [camera, scheduleFly]
    );

    useEffect(() => {
      if (!recenterRequest) return;
      if (recenterRequest.token === lastRecenterTokenRef.current) return;
      lastRecenterTokenRef.current = recenterRequest.token;
      scheduleFly(
        cameraPositionForPov(
          recenterRequest.lat,
          recenterRequest.lng,
          recenterRequest.altitude
        ),
        recenterRequest.durationMs
      );
    }, [recenterRequest, scheduleFly]);

    useFrame(() => {
      const controls = controlsRef.current;
      if (controls) {
        const flying = flyRef.current !== null;
        const dist = Math.max(
          camera.position.distanceTo(controls.target),
          CAMERA_MIN_DISTANCE
        );
        const zoomNorm = GLOBE_ROTATION_REF_DISTANCE / dist;
        controls.rotateSpeed = GLOBE_DRAG_ROTATE_BASE_SPEED * zoomNorm;
        controls.autoRotate = autoRotateEnabled && !flying;
        if (controls.autoRotate) {
          controls.autoRotateSpeed = GLOBE_AUTO_ROTATE_BASE_SPEED * zoomNorm;
        }
      }

      const fly = flyRef.current;
      if (!fly) return;
      const elapsed = performance.now() - fly.startMs;
      const t = Math.min(1, elapsed / fly.durationMs);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      camera.position.lerpVectors(fly.from, fly.to, eased);
      controlsRef.current?.update();
      if (t >= 1) flyRef.current = null;
    });

    return (
      <OrbitControls
        ref={controlsRef}
        enabled={controlsEnabled}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={GLOBE_DRAG_ROTATE_BASE_SPEED}
        zoomSpeed={1.2}
        minDistance={CAMERA_MIN_DISTANCE}
        maxDistance={CAMERA_MAX_DISTANCE}
        onStart={() => {
          flyRef.current = null;
          onInteractionStart();
        }}
        onEnd={onInteractionEnd}
        onChange={onControlsChange}
      />
    );
  }
);
