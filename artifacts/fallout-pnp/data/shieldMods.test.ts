import assert from 'node:assert/strict';
import test from 'node:test';
import { getArmorById } from './armor.ts';
import { computeModEffects, getModById } from './mods.ts';

test('Power Shield matches the Power Armor Helmet AC bonus', () => {
  const powerShield = getModById('shield_t4');
  const powerHelmet = getArmorById('power_helmet');
  assert.ok(powerShield);
  assert.ok(powerHelmet);
  assert.equal(powerShield.acBonus, 13);
  assert.equal(powerShield.acBonus, powerHelmet.acBonus);
  assert.equal(computeModEffects(['shield_t4']).acBonus, 13);
});