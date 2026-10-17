import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyVehicleSystemDamage,
  BUILT_IN_VEHICLES,
  spawnVehicleCharacter,
  vehicleProtectionForDamageType,
  vehicleSystemStatus,
} from './vehicles.ts';

test('manual vehicle catalog includes 24 profiles with AC defaulted to zero', () => {
  assert.equal(BUILT_IN_VEHICLES.length, 24);
  assert.ok(BUILT_IN_VEHICLES.every(vehicle => vehicle.armorClass === 0));
  assert.ok(BUILT_IN_VEHICLES.every(vehicle => vehicle.systems.length > 0));
});

test('vehicle hit systems are independent and structure HP backs the combatant HP', () => {
  const humvee = BUILT_IN_VEHICLES.find(vehicle => vehicle.id === 'humvee');
  assert.ok(humvee);
  const character = spawnVehicleCharacter(humvee, 'combatant-1');
  assert.equal(character.currentHp, humvee.systems.find(system => system.kind === 'structure')?.maxHp);
  assert.equal(character.maxHp, character.currentHp);
  assert.equal(character.vehicle?.inMotion, true);

  const damaged = applyVehicleSystemDamage(humvee, 'tire-1', 7);
  assert.equal(damaged.systems.find(system => system.id === 'tire-1')?.currentHp, 33);
  assert.equal(damaged.systems.find(system => system.id === 'tire-2')?.currentHp, 40);
  assert.equal(damaged.systems.find(system => system.kind === 'structure')?.currentHp, 300);
});

test('vehicle system is disabled only after losing more than 66 percent of its HP', () => {
  assert.equal(vehicleSystemStatus({ id: 'engine', name: 'Engine', kind: 'engine', currentHp: 34, maxHp: 100 }), 'operational');
  assert.equal(vehicleSystemStatus({ id: 'engine', name: 'Engine', kind: 'engine', currentHp: 33, maxHp: 100 }), 'disabled');
  assert.equal(vehicleSystemStatus({ id: 'engine', name: 'Engine', kind: 'engine', currentHp: 0, maxHp: 100 }), 'destroyed');
});

test('vehicle protection has no DT and uses the profile DR for each damage type', () => {
  const vehicle = BUILT_IN_VEHICLES.find(candidate => candidate.id === 'humvee');
  assert.ok(vehicle);
  assert.deepEqual(vehicleProtectionForDamageType(vehicle, 'normal'), { dt: 0, dr: 50 });
  assert.deepEqual(vehicleProtectionForDamageType(vehicle, 'plasma'), { dt: 0, dr: 30 });
});
