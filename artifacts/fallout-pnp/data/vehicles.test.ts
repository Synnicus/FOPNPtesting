import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyVehicleBlastDamage,
  applyVehicleSystemDamage,
  BUILT_IN_VEHICLES,
  isVehicleSystemElectronic,
  vehicleCanAttemptPilotCheck,
  vehicleCanStartMoving,
  vehicleMovementBlockReason,
  vehicleRequiresImmediatePilotCheck,
  vehicleSystemEffectDescription,
  resolveVehiclePerformance,
  spawnVehicleCharacter,
  vehicleProtectionForDamageType,
  vehicleSystemStatus,
  vehicleTargetToHitPenalty,
  vehicleUpgradeEffects,
  useVehicleNozBooster,
  resolveVehicleCrewAssignments,
} from './vehicles.ts';
import { BUILT_IN_VEHICLE_WEAPONS } from './vehicleWeapons.ts';
import { getWeaponAreaAttack } from './weapons.ts';
import { DEFAULT_SKILLS } from '../context/types.ts';

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

test('vehicle blasts damage Structure plus the chosen system, while EMP only damages electronics', () => {
  const humvee = BUILT_IN_VEHICLES.find(vehicle => vehicle.id === 'humvee');
  assert.ok(humvee);
  const structure = humvee.systems.find(system => system.kind === 'structure');
  const engine = humvee.systems.find(system => system.kind === 'engine');
  const tire = humvee.systems.find(system => system.kind === 'tire');
  const tread = humvee.systems.find(system => system.kind === 'tread');
  assert.ok(structure);
  assert.ok(engine);
  assert.ok(tire);

  assert.equal(isVehicleSystemElectronic(structure), false);
  assert.equal(isVehicleSystemElectronic(tire), false);
  if (tread) assert.equal(isVehicleSystemElectronic(tread), false);
  assert.equal(isVehicleSystemElectronic(engine), true);

  const blast = applyVehicleBlastDamage(humvee, 9, engine.id);
  assert.equal(blast.systems.find(system => system.kind === 'structure')?.currentHp, structure.currentHp - 9);
  assert.equal(blast.systems.find(system => system.kind === 'engine')?.currentHp, engine.currentHp - 9);

  const multiSystemBlast = applyVehicleBlastDamage(humvee, 9, [engine.id, tire.id, structure.id]);
  assert.equal(multiSystemBlast.systems.find(system => system.kind === 'structure')?.currentHp, structure.currentHp - 9);
  assert.equal(multiSystemBlast.systems.find(system => system.kind === 'engine')?.currentHp, engine.currentHp - 9);
  assert.equal(multiSystemBlast.systems.find(system => system.id === tire.id)?.currentHp, tire.currentHp - 9);

  const structureOnly = applyVehicleBlastDamage(humvee, 9, structure.id);
  assert.equal(structureOnly.systems.find(system => system.kind === 'structure')?.currentHp, structure.currentHp - 9);

  const empOnStructure = applyVehicleBlastDamage(humvee, 9, structure.id, true);
  const empOnTire = applyVehicleBlastDamage(humvee, 9, tire.id, true);
  assert.deepEqual(empOnStructure, humvee);
  assert.deepEqual(empOnTire, humvee);
  const empOnEngine = applyVehicleBlastDamage(humvee, 9, engine.id, true);
  assert.equal(empOnEngine.systems.find(system => system.kind === 'structure')?.currentHp, structure.currentHp);
  assert.equal(empOnEngine.systems.find(system => system.kind === 'engine')?.currentHp, engine.currentHp - 9);
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

test('inoperative vehicle systems apply their manual movement and driving consequences', () => {
  const base = BUILT_IN_VEHICLES.find(vehicle => vehicle.id === 'corvega_highwayman');
  assert.ok(base);
  const damageSystem = (kind: 'engine' | 'controls' | 'drive' | 'tire' | 'structure' | 'tread') => ({
    ...base,
    systems: base.systems.map(system => system.kind === kind
      ? { ...system, currentHp: Math.floor(system.maxHp * 0.33) }
      : system),
  });

  const engineOut = damageSystem('engine');
  assert.equal(resolveVehiclePerformance(engineOut).topSpeedKph, 0);
  assert.equal(resolveVehiclePerformance(engineOut).inMotion, false);
  assert.equal(vehicleCanStartMoving(engineOut), false);
  assert.match(vehicleMovementBlockReason(engineOut) ?? '', /Engine inoperative/);
  assert.match(vehicleSystemEffectDescription(resolveVehiclePerformance(engineOut).systems.find(system => system.kind === 'engine')!) ?? '', /coasts to a halt/);

  const controlsOut = damageSystem('controls');
  assert.equal(vehicleCanStartMoving(controlsOut), false);
  assert.equal(vehicleCanAttemptPilotCheck(controlsOut), false);
  assert.match(vehicleMovementBlockReason(controlsOut) ?? '', /cannot steer/);

  const driveOut = damageSystem('drive');
  assert.equal(resolveVehiclePerformance(driveOut).accelerationKphPerRound, 0);
  assert.equal(resolveVehiclePerformance(driveOut).inMotion, true);
  assert.equal(vehicleCanStartMoving(driveOut), false);
  assert.equal(vehicleCanAttemptPilotCheck(driveOut), true);
  assert.match(vehicleSystemEffectDescription(resolveVehiclePerformance(driveOut).systems.find(system => system.kind === 'drive')!) ?? '', /cannot accelerate/);

  const tireOut = damageSystem('tire');
  assert.equal(resolveVehiclePerformance(tireOut).topSpeedKph, base.topSpeedKph! * 0.25);
  assert.equal(vehicleRequiresImmediatePilotCheck(tireOut), true);
  assert.equal(vehicleCanAttemptPilotCheck(tireOut), true);
  assert.match(vehicleSystemEffectDescription(resolveVehiclePerformance(tireOut).systems.find(system => system.kind === 'tire')!) ?? '', /immediate Pilot roll/);

  const trackedBase = BUILT_IN_VEHICLES.find(vehicle => vehicle.systems.some(system => system.kind === 'tread'));
  assert.ok(trackedBase);
  const treadOut = {
    ...trackedBase,
    systems: trackedBase.systems.map(system => system.kind === 'tread'
      ? { ...system, currentHp: Math.floor(system.maxHp * 0.33) }
      : system),
  };
  assert.equal(resolveVehiclePerformance(treadOut).topSpeedKph, 0);
  assert.equal(resolveVehiclePerformance(treadOut).inMotion, false);
  assert.match(vehicleSystemEffectDescription(resolveVehiclePerformance(treadOut).systems.find(system => system.kind === 'tread')!) ?? '', /treat this as a crash/);

  const structureOut = damageSystem('structure');
  assert.equal(resolveVehiclePerformance(structureOut).topSpeedKph, base.topSpeedKph);
  assert.match(vehicleSystemEffectDescription(resolveVehiclePerformance(structureOut).systems.find(system => system.kind === 'structure')!) ?? '', /fall apart/);
});

test('engine or tread damage stops a moving vehicle, but drive damage allows it to coast', () => {
  const base = BUILT_IN_VEHICLES.find(vehicle => vehicle.id === 'corvega_highwayman');
  assert.ok(base);
  const system = base.systems.find(candidate => candidate.kind === 'engine');
  const tread = BUILT_IN_VEHICLES.find(vehicle => vehicle.systems.some(candidate => candidate.kind === 'tread'));
  assert.ok(system);
  assert.ok(tread);

  const engineStopped = applyVehicleSystemDamage(base, system.id, system.currentHp);
  assert.equal(engineStopped.inMotion, false);
  assert.equal(vehicleTargetToHitPenalty(engineStopped), 0);

  const drive = base.systems.find(candidate => candidate.kind === 'drive');
  assert.ok(drive);
  const driveCoasting = applyVehicleSystemDamage(base, drive.id, drive.currentHp);
  assert.equal(driveCoasting.inMotion, true);
  assert.equal(resolveVehiclePerformance(driveCoasting).accelerationKphPerRound, 0);

  const damagedTread = tread.systems.find(candidate => candidate.kind === 'tread');
  assert.ok(damagedTread);
  const treadStopped = applyVehicleSystemDamage(tread, damagedTread.id, damagedTread.currentHp);
  assert.equal(treadStopped.inMotion, false);
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
  const controls = withBooster.systems.find(system => system.kind === 'controls');
  assert.ok(controls);
  assert.equal(useVehicleNozBooster({
    ...withBooster,
    systems: withBooster.systems.map(system => system.id === controls.id ? { ...system, currentHp: 0 } : system),
  }), null);
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

test('vehicle crew resolution ignores missing, stored, vehicle, and combat-device references', () => {
  const pilot = {
    id: 'crew-pilot',
    name: 'Pilot',
    type: 'pc' as const,
    race: 'human' as const,
    level: 1,
    xp: 0,
    special: { strength: 5, perception: 5, endurance: 5, charisma: 5, intelligence: 5, agility: 5, luck: 5 },
    maxHp: 30, currentHp: 30, armorClass: 5, tempAC: 0, maxAP: 7, currentAP: 7,
    position: 'standing' as const, sequence: 10, skills: { ...DEFAULT_SKILLS },
    taggedSkills: [], unspentSkillPoints: 0, perks: [], weaponAmmoStates: [], injuries: [],
    isKnockedOut: false, knockOutRoundsLeft: 0, conditions: [],
    radiationResistance: 0, gasResistance: 0, electricityResistance: 0,
  };
  const storedGunner = { ...pilot, id: 'stored-gunner', inStorage: true };
  const combatDevice = { ...pilot, id: 'combat-device', combatDevice: {
    kind: 'mine' as const, weaponId: 'mine', ownerCharacterId: pilot.id, status: 'armed' as const,
  } };
  const vehicle = spawnVehicleCharacter(BUILT_IN_VEHICLES[0], 'crew-resolution');
  const crew = resolveVehicleCrewAssignments({
    ...vehicle,
    vehicleCrew: { pilotCharacterId: pilot.id, gunnerCharacterId: storedGunner.id },
  }, [pilot, storedGunner, combatDevice]);

  assert.equal(crew.pilot?.id, pilot.id);
  assert.equal(crew.gunner, null, 'stored crew is not treated as an active gunner');
  assert.deepEqual(resolveVehicleCrewAssignments({
    ...vehicle,
    vehicleCrew: { pilotCharacterId: 'deleted-character', gunnerCharacterId: vehicle.id },
  }, [vehicle]), { pilot: null, gunner: null });
  assert.deepEqual(resolveVehicleCrewAssignments({
    ...vehicle,
    vehicleCrew: { pilotCharacterId: combatDevice.id, gunnerCharacterId: storedGunner.id },
  }, [combatDevice, storedGunner]), { pilot: null, gunner: null });
});

test('vehicle cannon weapon profiles follow the manual damage, range, and AP values', () => {
  const byId = new Map(BUILT_IN_VEHICLE_WEAPONS.map(weapon => [weapon.id, weapon]));
  assert.deepEqual(
    [
      'vehicle_20mm_cannon',
      'vehicle_25mm_cannon',
      'vehicle_m68_105mm_cannon',
      'rheinmetall_120mm_gun',
      'vehicle_152mm_shillelagh',
    ].map(id => {
      const weapon = byId.get(id);
      return [weapon?.damageDieCount, weapon?.damageDie, weapon?.damageBonus, weapon?.rangeNormal, weapon?.apSingle];
    }),
    [
      [8, 10, 40, 500, 4],
      [8, 10, 40, 500, 4],
      [15, 20, 30, 1000, 5],
      [20, 20, 50, 2000, 5],
      [20, 20, 50, 3000, 6],
    ],
  );
});

test('every built-in vehicle cannon resolves to its own blast and concussion profile', () => {
  for (const weapon of BUILT_IN_VEHICLE_WEAPONS) {
    assert.ok(weapon.areaAttackProfileId, `${weapon.name} should reference its area profile`);
    const profile = getWeaponAreaAttack(weapon);
    assert.equal(profile?.profileId, weapon.areaAttackProfileId);
    assert.equal(profile?.kind, 'explosion');
  }
});
