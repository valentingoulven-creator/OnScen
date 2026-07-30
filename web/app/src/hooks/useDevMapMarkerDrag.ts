import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { isDevStaff } from '../lib/adminStaffRoles';
import {
  devMapMarkerKey,
  filterDevDraggableOverrides,
  isDevDraggableMarkerKind,
  mergeDevMapMarkerOverrides,
  readDevMapMarkerOverridesFromStorage,
  writeDevMapMarkerOverridesToStorage,
  type DevMapMarkerOverrides,
  type DevMapMarkerPosition,
  type DevMapMarkerRef,
} from '../lib/devMapMarkerDrag';
import { isValidLatLng } from '../lib/mapCoords';
import { MAP_MARKER_DRAG_REFRESH_EVENT } from '../lib/mapUiEvents';

const isMsdevBuild = import.meta.env.VITE_APP_ENV === 'msdev';

export function useDevMapMarkerDrag() {
  const { user, token } = useAuth();
  const isDev = isDevStaff(user);
  const [overrides, setOverrides] = useState<DevMapMarkerOverrides>(() =>
    isDev ? readDevMapMarkerOverridesFromStorage() : new Map()
  );

  useEffect(() => {
    if (!isDev) {
      setOverrides(new Map());
      return;
    }
    setOverrides(readDevMapMarkerOverridesFromStorage());
  }, [isDev]);

  useEffect(() => {
    if (!isDev || !token || !isMsdevBuild) return;
    let cancelled = false;
    void api
      .getDevMapMarkerPositions(token)
      .then(({ positions }) => {
        if (cancelled || !positions?.length) return;
        const merged = filterDevDraggableOverrides(
          mergeDevMapMarkerOverrides(readDevMapMarkerOverridesFromStorage(), positions)
        );
        setOverrides(merged);
        writeDevMapMarkerOverridesToStorage(merged);
      })
      .catch(() => {
        /* msdev API optionnelle — overrides locaux conservés */
      });
    return () => {
      cancelled = true;
    };
  }, [isDev, token]);

  const commitPosition = useCallback(
    (ref: DevMapMarkerRef, latitude: number, longitude: number) => {
      if (!isDev || !isDevDraggableMarkerKind(ref.kind) || !isValidLatLng(latitude, longitude)) return;
      const entry: DevMapMarkerPosition = {
        kind: ref.kind,
        id: ref.id,
        latitude,
        longitude,
      };
      setOverrides((prev) => {
        const next = new Map(prev);
        next.set(devMapMarkerKey(ref.kind, ref.id), entry);
        writeDevMapMarkerOverridesToStorage(next);
        return next;
      });
      window.dispatchEvent(new Event(MAP_MARKER_DRAG_REFRESH_EVENT));
      if (token && isMsdevBuild) {
        void api
          .setDevMapMarkerPosition(token, ref.kind, ref.id, latitude, longitude)
          .catch(() => {
            /* persistance msdev best-effort */
          });
      }
    },
    [isDev, token]
  );

  const devMarkerDragEnabled = isDev;

  return useMemo(
    () => ({
      isDev,
      devMarkerDragEnabled,
      overrides,
      onDevMarkerDragEnd: commitPosition,
    }),
    [isDev, devMarkerDragEnabled, overrides, commitPosition]
  );
}
