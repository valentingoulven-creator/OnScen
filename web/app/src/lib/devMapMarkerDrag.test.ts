import { describe, expect, it } from 'vitest';
import {
  applyDevMarkerOverridesToEvents,
  devMapMarkerKey,
  filterDevDraggableOverrides,
  isDevDraggableMarkerKind,
  mergeDevMapMarkerOverrides,
} from './devMapMarkerDrag';

describe('devMapMarkerDrag', () => {
  it('autorise le drag uniquement pour les événements', () => {
    expect(isDevDraggableMarkerKind('event')).toBe(true);
    expect(isDevDraggableMarkerKind('salon')).toBe(false);
    expect(isDevDraggableMarkerKind('live')).toBe(false);
    expect(isDevDraggableMarkerKind('person')).toBe(false);
  });

  it('filtre les overrides non-événement', () => {
    const overrides = mergeDevMapMarkerOverrides(new Map(), [
      { kind: 'salon', id: 's1', latitude: 48.86, longitude: 2.35 },
      { kind: 'event', id: 'evt1', latitude: 45.75, longitude: 4.83 },
    ]);
    const filtered = filterDevDraggableOverrides(overrides);
    expect(filtered.size).toBe(1);
    expect(filtered.get(devMapMarkerKey('event', 'evt1'))?.latitude).toBe(45.75);
  });

  it('applique une override événement', () => {
    const overrides = mergeDevMapMarkerOverrides(new Map(), [
      { kind: 'event', id: 'evt1', latitude: 45.75, longitude: 4.83 },
    ]);
    const out = applyDevMarkerOverridesToEvents(
      [{ id: 'evt1', latitude: 43.6, longitude: 3.87, title: 'Fest' }],
      overrides
    );
    expect(out[0]?.latitude).toBe(45.75);
    expect(devMapMarkerKey('event', 'evt1')).toBe('event:evt1');
  });

  it('ignore les overrides salon lors du merge', () => {
    const overrides = mergeDevMapMarkerOverrides(new Map(), [
      { kind: 'salon', id: 's1', latitude: 48.86, longitude: 2.35 },
    ]);
    expect(overrides.size).toBe(0);
  });
});
