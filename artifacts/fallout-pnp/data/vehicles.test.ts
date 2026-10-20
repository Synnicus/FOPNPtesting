import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyVehicleSystemDamage,
  BUILT_IN_VEHICLES,
  resolveVehiclePerformance,
  spawnVehicleCharacter,
  vehicleProtectionForDamageType,
  vehicleSystemStatus,
  vehicleTargetToHitPenalty,
  vehicleUpgradeEffects,
  useVehicleNozBooster,
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

test('spawned vehicles inherit their user-supplied catalog photo', () => {
  const humvee = BUILT_IN_VEHICLES.find(vehicle => vehicle.id === 'humvee');
  assert.ok(humvee);
  const portrait = 'data:image/png;base64,AQID';
  const portraitOffset = { x: 0.4, y: 0.6 };
  const character = spawnVehicleCharacter({
    ...humvee,
    portrait,
    portraitFit: 'contain',
    portraitOffset,
  }, 'photo-test');
  assert.equal(character.portrait, portrait);
  assert.equal(character.vehicle?.portrait, portrait);
  assert.equal(character.portraitFit, 'contain');
  assert.deepEqual(character.portraitOffset, portraitOffset);
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

test('installed upgrades resolve manual performance without changing the saved base profile', () => {
  const base = BUILT_IN_VEHICLES.find(vehicle => vehicle.id === 'corvega_highwayman');
  assert.ok(base);
  const customized = {
    ...base,
    topSpeedKph: 100,
    accelerationKphPerRound: 30,
    brakingKphPerRound: 20,
    turningRadiusMeters: 4,
    rangeKm: 100,
    carryingWeightLb: '2,500',
    terrainPilotModifier: 0,
    systems: base.systems.map(system => system.kind === 'tire'
      ? { ...system, currentHp: 8, maxHp: 10 }
      : system),
    enhancements: ['Slicks', 'NOz Booster', 'Reinforced Struts', 'Fuel Cell Converter', 'Antigrav Plates'],
  };
  const performance = resolveVehiclePerformance(customized);

  assert.deepEqual({
    topSpeedKph: performance.topSpeedKph,
    accelerationKphPerRound: performance.accelerationKphPerRound,
    brakingKphPerRound: performance.brakingKphPerRound,
    turningRadiusMeters: performance.turningRadiusMeters,
    rangeKm: performance.rangeKm,
    carryingWeightLb: performance.carryingWeightLb,
    terrainPilotModifier: performance.terrainPilotModifier,
  }, {
    topSpeedKph: 200.5,
    accelerationKphPerRound: 40,
    brakingKphPerRound: 10,
    turningRadiusMeters: 9,
    rangeKm: 150,
    carryingWeightLb: '3,750',
    terrainPilotModifier: -10,
  });
  assert.ok(performance.systems.filter(system => system.kind === 'tire')
    .every(system => system.currentHp === 5 && system.maxHp === 5));
  assert.equal(customized.topSpeedKph, 100);
  assert.equal(customized.systems.find(system => system.kind === 'tire')?.maxHp, 10);

  const tireId = customized.systems.find(system => system.kind === 'tire')?.id;
  assert.ok(tireId);
  const damaged = applyVehicleSystemDamage(customized, tireId, 2);
  assert.equal(resolveVehiclePerformance(damaged).systems.find(system => system.id === tireId)?.currentHp, 3);
  assert.equal(resolveVehiclePerformance(damaged).systems.find(system => system.id === tireId)?.maxHp, 5);
  const slicksRemoved = {
    ...damaged,
    enhancements: damaged.enhancements.filter(name => name !== 'Slicks'),
  };
  assert.equal(resolveVehiclePerformance(slicksRemoved).systems.find(system => system.id === tireId)?.currentHp, 3);
  assert.equal(resolveVehiclePerformance(slicksRemoved).systems.find(system => system.id === tireId)?.maxHp, 10);
});

test('Slicks only affect cars and motorcycles, and antigrav gives no waterborne top-speed bonus', () => {
  const base = BUILT_IN_VEHICLES.find(vehicle => vehicle.id === 'corvega_highwayman');
  assert.ok(base);
  const truck = { ...base, category: 'truck' as const, enhancements: ['Slicks'] };
  assert.equal(vehicleUpgradeEffects(truck).slicks, false);
  assert.equal(resolveVehiclePerformance(truck).topSpeedKph, truck.topSpeedKph);

  const boat = BUILT_IN_VEHICLES.find(vehicle => vehicle.category === 'boat');
  assert.ok(boat);
  const antigravBoat = { ...boat, enhancements: ['Antigrav Plates'] };
  assert.equal(vehicleUpgradeEffects(antigravBoat).antigravPlates, false);
  assert.equal(resolveVehiclePerformance(antigravBoat).topSpeedKph, boat.topSpeedKph);
});

test('NOz use damages the engine by 5 HP and becomes unavailable after engine destruction', () => {
  const base = BUILT_IN_VEHICLES.find(vehicle => vehicle.id === 'corvega_highwayman');
  assert.ok(base);
  const withBooster = { ...base, enhancements: ['NOz Booster'] };
  const used = useVehicleNozBooster(withBooster);
  assert.ok(used);
  assert.equal(used.systems.find(system => system.kind === 'engine')?.currentHp, 45);
  assert.equal(withBooster.systems.find(system => system.kind === 'engine')?.currentHp, 50);
  assert.equal(useVehicleNozBooster({
    ...withBooster,
    systems: withBooster.systems.map(system => system.kind === 'engine' ? { ...system, currentHp: 0 } : system),
  }), null);
  assert.equal(useVehicleNozBooster(base), null);
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
