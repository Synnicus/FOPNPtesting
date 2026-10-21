import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { DEFAULT_VEHICLE_BOARD_FOOTPRINTS, vehicleBoardFootprint } from './vehicles.ts';
import type { VehicleCategory } from '../context/types';

test('vehicle board footprints provide a default for every vehicle category', () => {
  for (const category of Object.keys(DEFAULT_VEHICLE_BOARD_FOOTPRINTS) as VehicleCategory[]) {
    const defaults = DEFAULT_VEHICLE_BOARD_FOOTPRINTS[category];
    assert.deepEqual(vehicleBoardFootprint({ category }), defaults);
    assert.ok(defaults.width >= 1 && defaults.length >= 1);
  }
});

test('custom vehicle footprints are rounded and limited to the supported map range', () => {
  assert.deepEqual(vehicleBoardFootprint({ category: 'car', boardHexWidth: 2.8, boardHexLength: 4.2 }), {
    width: 3,
    length: 4,
  });
  assert.deepEqual(vehicleBoardFootprint({ category: 'car', boardHexWidth: -2, boardHexLength: 24 }), {
    width: 1,
    length: 12,
  });
});
