import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveAttackWeapon, resolveDamagePipeline } from './attackResolution.ts';

test('an explicitly selected held weapon is authoritative for the attack session', () => {
  const primary = { id: 'primary', damageType: 'normal', damageDie: 6 };
  const offhand = { id: 'offhand', damageType: 'laser', damageDie: 10 };

  assert.equal(resolveAttackWeapon(primary, null, [primary, offhand]), primary);
  assert.equal(resolveAttackWeapon(primary, offhand.id, [primary, offhand]), offhand);
});

test('a stale attack weapon selection falls back to the active weapon', () => {
  const primary = { id: 'primary' };
  assert.equal(resolveAttackWeapon(primary, 'no-longer-held', [primary]), primary);
});

test('physical initial damage is multiplied before DT and DR are applied', () => {
  assert.deepEqual(
    resolveDamagePipeline({
      initialDiceDamage: 10,
      flatDamageBonus: 2,
      criticalMultiplier: 2,
      damageThreshold: 4,
      damageResistance: 25,
    }),
    {
      baseDamage: 24,
      afterDamageThreshold: 20,
      finalDamage: 15,
    },
  );
});

test('manual creature damage can preserve printed DR above the normal 90% cap', () => {
  assert.deepEqual(
    resolveDamagePipeline({
      initialDiceDamage: 100,
      flatDamageBonus: 0,
      criticalMultiplier: 1,
      damageThreshold: 0,
      damageResistance: 95,
      damageResistanceCap: 100,
    }),
    {
      baseDamage: 100,
      afterDamageThreshold: 100,
      finalDamage: 5,
    },
  );
});