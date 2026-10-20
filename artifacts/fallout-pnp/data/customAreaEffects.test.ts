import assert from 'node:assert/strict';
import test from 'node:test';
import { validateCustomAreaEffects } from './customAreaEffects.ts';
import { getWeaponAreaAttack } from './weapons.ts';
import type { Weapon } from '../context/types.ts';

const effects = [{
  id: 'blast',
  label: 'Main blast',
  kind: 'explosion' as const,
  damageType: 'explosion' as const,
  damageDieCount: 2,
  damageDie: 8,
  damageBonus: 4,
  radius: 10,
}];

test('custom area effect validation rejects malformed, duplicate, and inverted zone ranges', () => {
  assert.deepEqual(validateCustomAreaEffects(effects, 'hex'), []);
  assert.match(validateCustomAreaEffects([
    effects[0],
    { ...effects[0], label: 'Duplicate' },
  ], 'hex').join(' '), /unique/i);
  assert.match(validateCustomAreaEffects([{
    ...effects[0], minDistance: 11,
  }], 'hex').join(' '), /cannot exceed/i);
  assert.match(validateCustomAreaEffects(effects, 'feet').join(' '), /hexes or meters/i);
});

test('custom mine and trap weapons expose their saved area profile to combat', () => {
  const weapon: Weapon = {
    id: 'custom-mine',
    name: 'Custom Mine',
    category: 'minesTraps',
    damageType: 'explosion',
    damageDieCount: 1,
    damageDie: 6,
    damageBonus: 0,
    skill: 'traps',
    burstLimit: 1,
    isDoubleShot: false,
    magazineSize: 0,
    weight: 0,
    minStr: 1,
    rangeNormal: 0,
    knockdownChance: 0,
    mods: [],
    isCustom: true,
    customAreaEffects: effects,
    areaRangeUnit: 'm',
  };
  const attack = getWeaponAreaAttack(weapon);
  assert.equal(attack?.profileId, 'custom-weapon:custom-mine');
  assert.equal(attack?.kind, 'explosion');
});

