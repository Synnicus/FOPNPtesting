import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyVehicleSystemDamage,
  BUILT_IN_VEHICLES,
  spawnVehicleCharacter,
  vehicleProtectionForDamageType,
  vehicleSystemStatus,
  vehicleTargetToHitPenalty,
} from './vehicles.ts';
import { BUILT_IN_VEHICLE_WEAPONS } from './vehicleWeapons.ts';

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

test('moving-target hit penalty is scoped to vehicle defenders and can be turned off', () => {
  const vehicle = BUILT_IN_VEHICLES.find(candidate => candidate.id === 'humvee');
  assert.ok(vehicle);
  assert.equal(vehicleTargetToHitPenalty(vehicle), -10);
  assert.equal(vehicleTargetToHitPenalty({ ...vehicle, inMotion: false }), 0);
  assert.equal(vehicleTargetToHitPenalty(undefined), 0);
});

test('mounted vehicle weapons resolve to combat weapons, including duplicate mounts', () => {
  const abrams = BUILT_IN_VEHICLES.find(vehicle => vehicle.id === 'm1a1_abrams');
  assert.ok(abrams);
  const slots = abrams.weaponSlots ?? [];
  assert.deepEqual(
    slots.map(slot => [slot.weaponId, slot.quantity]),
    [
      ['rheinmetall_120mm_gun', 1],
      ['m2hb', 2],
      ['tow_ii_missile_defense_system', 1],
    ],
  );
  assert.ok(slots.every(slot =>
    BUILT_IN_VEHICLE_WEAPONS.some(weapon => weapon.id === slot.weaponId)
      || slot.weaponId === 'm2hb'
      || slot.weaponId === 'tow_ii_missile_defense_system'));
});

test('vehicle cannon weapon profiles follow the manual damage, range, and AP values', () => {
  const byId = new Map(BUILT_IN_VEHICLE_WEAPONS.map(weapon => [weapon.id, weapon]));
  assert.deepEqual(
    ['vehicle_20mm_cannon', 'vehicle_25mm_cannon'].map(id => {
      const weapon = byId.get(id);
      return [weapon?.damageDieCount, weapon?.damageDie, weapon?.damageBonus, weapon?.rangeNormal, weapon?.apSingle];
    }),
    [[8, 10, 40, 500, 4], [8, 10, 40, 500, 4]],
  );
  assert.deepEqual(
    ['vehicle_m68_105mm_cannon', 'rheinmetall_120mm_gun', 'vehicle_152mm_shillelagh']
      .map(id => {
        const weapon = byId.get(id);
        return [weapon?.damageDieCount, weapon?.damageDie, weapon?.damageBonus, weapon?.rangeNormal, weapon?.apSingle];
      }),
    [[15, 20, 30, 1000, 5], [20, 20, 50, 2000, 5], [20, 20, 50, 3000, 6]],
  );
});
