import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import type { Character, InitiativeEntry } from '../context/types.ts';
import { createVehicleInitiativeEntry, sortInitiativeEntries, syncVehicleInitiativeEntries } from './initiativeSync.ts';

const driverEntry = (id: string, initiative: number, sequence = 0): InitiativeEntry => ({
  id: `init-${id}`,
  characterId: id,
  name: id,
  initiative,
  sequence,
  currentAP: 8,
  maxAP: 8,
  currentHp: 20,
  maxHp: 20,
  armorClass: 10,
  tempAC: 0,
  position: 'standing',
  hasActed: false,
  isActive: false,
});

const vehicleCharacter = (
  id: string,
  pilotCharacterId?: string,
  initiative = 0,
): Character => ({
  id,
  name: id,
  currentHp: 70,
  maxHp: 70,
  armorClass: 12,
  position: 'standing',
  vehicle: { armorClass: 12 } as Character['vehicle'],
  ...(pilotCharacterId ? { vehicleCrew: { pilotCharacterId } } : {}),
} as unknown as Character);

test('vehicle turns always follow characters and sort by driver initiative', () => {
  const entries = [
    driverEntry('fast-character', 18, 8),
    { ...driverEntry('faster-vehicle', 99, 6), turnKind: 'vehicle' as const, driverInitiative: 14 },
    driverEntry('slow-character', 5, 2),
    { ...driverEntry('slower-vehicle', 99, 4), turnKind: 'vehicle' as const, driverInitiative: 7 },
    { ...driverEntry('unpiloted-vehicle', 99, 9), turnKind: 'vehicle' as const, driverInitiative: -1 },
  ];
  assert.deepEqual(sortInitiativeEntries(entries).map(entry => entry.id), [
    'init-fast-character',
    'init-slow-character',
    'init-faster-vehicle',
    'init-slower-vehicle',
    'init-unpiloted-vehicle',
  ]);
});

test('vehicle initiative entries use driver initiative and never receive AP', () => {
  const driver = driverEntry('driver', 17, 8);
  const vehicle = vehicleCharacter('truck', 'driver');
  const entry = createVehicleInitiativeEntry(vehicle, driver);
  assert.equal(entry.turnKind, 'vehicle');
  assert.equal(entry.driverInitiative, 17);
  assert.equal(entry.initiative, 17);
  assert.equal(entry.maxAP, 0);
  assert.equal(entry.currentAP, 0);
});

test('vehicle rows refresh from the current driver initiative and deployed vehicle record', () => {
  const driver = driverEntry('driver', 21, 10);
  const vehicle = vehicleCharacter('truck', 'driver');
  const staleEntry = {
    ...createVehicleInitiativeEntry(vehicle, driver),
    driverInitiative: 3,
    initiative: 3,
    currentHp: 20,
    maxAP: 8,
    currentAP: 6,
  };
  const [syncedDriver, syncedVehicle] = syncVehicleInitiativeEntries(
    [staleEntry, driver],
    [vehicle],
  );
  assert.equal(syncedVehicle.turnKind, 'vehicle');
  assert.equal(syncedVehicle.driverInitiative, 21);
  assert.equal(syncedVehicle.sequence, 10);
  assert.equal(syncedVehicle.currentHp, 70);
  assert.equal(syncedVehicle.maxAP, 0);
  assert.equal(syncedVehicle.currentAP, 0);
  assert.equal(syncedDriver.id, driver.id);
});

test('initiative setup includes vehicles and each vehicle turn resolves on its own turn', () => {
  const appSource = readFileSync(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');
  const contextSource = readFileSync(new URL('../context/AppContext.tsx', import.meta.url), 'utf8');
  const visualizerSource = readFileSync(new URL('../components/CombatVisualizerModal.tsx', import.meta.url), 'utf8');
  assert.match(appSource, /const initiativeSetupVehicles = activeCharacters\.filter\(c => c\.vehicle/);
  assert.match(appSource, /createVehicleInitiativeEntry\(vehicle, driverEntry\)/);
  assert.match(appSource, /END VEHICLE TURN/);
  assert.match(contextSource, /currentActive\?\.turnKind === 'vehicle'/);
  assert.match(contextSource, /resolveDrivingVehicleTurn\(/);
  assert.match(contextSource, /End each vehicle turn in driver-initiative order/);
  assert.match(visualizerSource, /e\.turnKind === 'vehicle' \? `VEHICLE · \$\{e\.name\}`/);
});
