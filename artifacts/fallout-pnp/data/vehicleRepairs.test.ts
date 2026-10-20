import assert from 'node:assert/strict';
import test from 'node:test';
import { CRITICAL_HIT_TABLE, vehicleCriticalEffects } from './criticals.ts';
import {
  applyVehicleSystemDamage,
  BUILT_IN_VEHICLES,
  resolveVehicleRepairAttempt,
  VEHICLE_REPAIR_HOURS,
} from './vehicles.ts';

const repairInput = (overrides: Partial<Parameters<typeof resolveVehicleRepairAttempt>[1]> = {}) => ({
  id: 'repair-attempt-1',
  systemId: 'engine',
  mechanicCharacterId: 'mechanic-1',
  mechanicName: 'Mechanic',
  repairSkill: 75,
  checkRoll: 42,
  repairDice: [4, 5, 6],
  createdAt: '2026-10-19T12:00:00.000Z',
  ...overrides,
});

test('vehicle repair follows the manual: 8 hours, Repair check, and 3d10 capped to one section', () => {
  const vehicle = BUILT_IN_VEHICLES[0];
  const damaged = applyVehicleSystemDamage(vehicle, 'engine', 20);
  const engineBefore = damaged.systems.find(system => system.id === 'engine')!;
  const otherSystemBefore = damaged.systems.find(system => system.id === 'controls')!;

  const result = resolveVehicleRepairAttempt(damaged, repairInput());
  assert.ok(result);
  assert.equal(VEHICLE_REPAIR_HOURS, 8);
  assert.equal(result.record.succeeded, true);
  assert.equal(result.record.rolledRepairHp, 15);
  assert.equal(result.record.restoredHp, 15);
  assert.equal(result.vehicle.systems.find(system => system.id === 'engine')?.currentHp, engineBefore.currentHp + 15);
  assert.deepEqual(result.vehicle.systems.find(system => system.id === 'controls'), otherSystemBefore);
  assert.equal(result.vehicle.repairHistory?.length, 1);
  assert.deepEqual(damaged.systems.find(system => system.id === 'engine'), engineBefore, 'input profile remains unchanged');
});

test('failed vehicle repair checks are logged without restoring HP', () => {
  const damaged = applyVehicleSystemDamage(BUILT_IN_VEHICLES[0], 'engine', 20);
  const hpBefore = damaged.systems.find(system => system.id === 'engine')?.currentHp;
  const result = resolveVehicleRepairAttempt(damaged, repairInput({
    repairSkill: 25,
    checkRoll: 80,
    repairDice: [],
  }));

  assert.ok(result);
  assert.equal(result.record.succeeded, false);
  assert.equal(result.record.restoredHp, 0);
  assert.deepEqual(result.record.repairDice, []);
  assert.equal(result.vehicle.systems.find(system => system.id === 'engine')?.currentHp, hpBefore);
  assert.equal(result.vehicle.repairHistory?.[0]?.checkRoll, 80);
});

test('destroyed or fully repaired vehicle sections cannot be repaired', () => {
  const vehicle = BUILT_IN_VEHICLES[0];
  assert.equal(resolveVehicleRepairAttempt(vehicle, repairInput()), null);
  const destroyed = applyVehicleSystemDamage(vehicle, 'engine', 10_000);
  assert.equal(resolveVehicleRepairAttempt(destroyed, repairInput()), null);
});

test('vehicle critical resolution skips character injuries and destroys only the selected system on instant death', () => {
  const crippledArm = CRITICAL_HIT_TABLE.find(entry => entry.roll === 1)!;
  const unconscious = CRITICAL_HIT_TABLE.find(entry => entry.roll === 6)!;
  const instantDeath = CRITICAL_HIT_TABLE.find(entry => entry.roll === 10)!;
  const tripleDamage = CRITICAL_HIT_TABLE.find(entry => entry.roll === 3)!;
  const armorBypass = CRITICAL_HIT_TABLE.find(entry => entry.roll === 7)!;

  assert.deepEqual(vehicleCriticalEffects(crippledArm), {
    destroySelectedSystem: false,
    ignoreCharacterOnlyEffects: true,
  });
  assert.equal(vehicleCriticalEffects(unconscious).ignoreCharacterOnlyEffects, true);
  assert.deepEqual(vehicleCriticalEffects(instantDeath), {
    destroySelectedSystem: true,
    ignoreCharacterOnlyEffects: false,
  });
  assert.equal(tripleDamage.damageMultiplier, 3);
  assert.equal(armorBypass.bypassesArmor, true);
});
