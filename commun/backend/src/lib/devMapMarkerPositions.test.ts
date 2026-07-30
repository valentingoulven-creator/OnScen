import { describe, expect, it, beforeEach } from 'vitest';
import {
  listDevMapMarkerPositions,
  restoreDevMapMarkerPositions,
  setDevMapMarkerPosition,
  snapshotDevMapMarkerPositions,
} from './devMapMarkerPositions';

describe('devMapMarkerPositions', () => {
  beforeEach(() => {
    restoreDevMapMarkerPositions([]);
  });

  it('persiste une position événement', () => {
    const entry = setDevMapMarkerPosition('event', 'evt_test', 43.61, 3.88);
    expect(entry.latitude).toBe(43.61);
    expect(listDevMapMarkerPositions()).toHaveLength(1);
    expect(snapshotDevMapMarkerPositions()[0]?.kind).toBe('event');
  });

  it('rejette les types salon/live/person', () => {
    expect(() => setDevMapMarkerPosition('salon', 'salon_test', 43.61, 3.88)).toThrow(
      /événement/i
    );
    expect(() => setDevMapMarkerPosition('live', 'live_1', 43.61, 3.88)).toThrow(/événement/i);
    expect(() => setDevMapMarkerPosition('person', 'user_1', 43.61, 3.88)).toThrow(/événement/i);
    expect(listDevMapMarkerPositions()).toHaveLength(0);
  });

  it('rejette des coords invalides', () => {
    expect(() => setDevMapMarkerPosition('event', 'evt_1', 999, 3)).toThrow(/invalides/i);
  });

  it('ignore les anciennes positions salon à la restauration', () => {
    restoreDevMapMarkerPositions([
      { kind: 'salon', id: 's1', latitude: 43.6, longitude: 3.87, updatedAt: 1 },
      { kind: 'event', id: 'e1', latitude: 45.0, longitude: 4.0, updatedAt: 2 },
    ]);
    expect(listDevMapMarkerPositions()).toHaveLength(1);
    expect(listDevMapMarkerPositions()[0]?.id).toBe('e1');
  });
});
