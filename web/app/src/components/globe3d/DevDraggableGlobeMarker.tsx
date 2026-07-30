import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { useThree } from '@react-three/fiber';
import { clientPointToGlobeLatLng } from '../../lib/globe3d/globeDevMarkerDrag';
import type { DevMapMarkerRef } from '../../lib/devMapMarkerDrag';
import { GlobeFacingHtml } from './GlobeFacingHtml';

interface GlobeDevDragContextValue {
  devMarkerDragEnabled: boolean;
  setControlsEnabled: (enabled: boolean) => void;
  onDevMarkerDragEnd?: (ref: DevMapMarkerRef, lat: number, lng: number) => void;
}

const GlobeDevDragContext = createContext<GlobeDevDragContextValue>({
  devMarkerDragEnabled: false,
  setControlsEnabled: () => {},
});

export function GlobeDevDragProvider({
  devMarkerDragEnabled,
  onDevMarkerDragEnd,
  setControlsEnabled,
  children,
}: {
  devMarkerDragEnabled: boolean;
  onDevMarkerDragEnd?: (ref: DevMapMarkerRef, lat: number, lng: number) => void;
  setControlsEnabled: (enabled: boolean) => void;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({ devMarkerDragEnabled, onDevMarkerDragEnd, setControlsEnabled }),
    [devMarkerDragEnabled, onDevMarkerDragEnd, setControlsEnabled]
  );
  return <GlobeDevDragContext.Provider value={value}>{children}</GlobeDevDragContext.Provider>;
}

interface DevDraggableGlobeHtmlMarkerProps {
  markerRef: DevMapMarkerRef;
  lat: number;
  lng: number;
  zIndexRange?: [number, number];
  center?: boolean;
  children: (props: {
    onPointerDown: (event: ReactPointerEvent) => void;
    devDragClassName?: string;
  }) => ReactNode;
}

export function DevDraggableGlobeHtmlMarker({
  markerRef,
  lat,
  lng,
  zIndexRange,
  center,
  children,
}: DevDraggableGlobeHtmlMarkerProps) {
  const { devMarkerDragEnabled, onDevMarkerDragEnd, setControlsEnabled } =
    useContext(GlobeDevDragContext);
  const { camera, gl } = useThree();
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const [pos, setPos] = useState({ lat, lng });

  useEffect(() => {
    if (!draggingRef.current) {
      setPos({ lat, lng });
    }
  }, [lat, lng]);

  const projectPointer = useCallback(
    (clientX: number, clientY: number) =>
      clientPointToGlobeLatLng(clientX, clientY, gl.domElement, camera),
    [camera, gl.domElement]
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent) => {
      if (!devMarkerDragEnabled || !onDevMarkerDragEnd || markerRef.kind !== 'event') return;
      if (event.button !== 0) return;
      draggingRef.current = true;
      movedRef.current = false;
      pointerIdRef.current = event.pointerId;
      setControlsEnabled(false);
      event.stopPropagation();
      event.preventDefault();
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    },
    [devMarkerDragEnabled, onDevMarkerDragEnd, setControlsEnabled]
  );

  useEffect(() => {
    if (!devMarkerDragEnabled) return;

    const onMove = (event: PointerEvent) => {
      if (!draggingRef.current || pointerIdRef.current !== event.pointerId) return;
      const coords = projectPointer(event.clientX, event.clientY);
      if (!coords) return;
      movedRef.current = true;
      setPos({ lat: coords.lat, lng: coords.lng });
    };

    const onUp = (event: PointerEvent) => {
      if (!draggingRef.current || pointerIdRef.current !== event.pointerId) return;
      draggingRef.current = false;
      pointerIdRef.current = null;
      setControlsEnabled(true);
      const coords = projectPointer(event.clientX, event.clientY);
      if (coords && movedRef.current && onDevMarkerDragEnd) {
        onDevMarkerDragEnd(markerRef, coords.lat, coords.lng);
      }
      movedRef.current = false;
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [
    devMarkerDragEnabled,
    markerRef,
    onDevMarkerDragEnd,
    projectPointer,
    setControlsEnabled,
  ]);

  return (
    <GlobeFacingHtml lat={pos.lat} lng={pos.lng} zIndexRange={zIndexRange} center={center}>
      {children({
        onPointerDown: handlePointerDown,
        devDragClassName: devMarkerDragEnabled && markerRef.kind === 'event' ? 'globe-marker--dev-draggable' : undefined,
      })}
    </GlobeFacingHtml>
  );
}
