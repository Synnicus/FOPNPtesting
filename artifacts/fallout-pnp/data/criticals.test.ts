import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyHelmetHeadCritReduction,
  criticalFailureSelfDamage,
  HELMET_HEAD_CRIT_REDUCTION,
} from './criticals.ts';

test('a protective helmet lowers targeted head critical chance by 15 percentage points', () => {
  assert.equal(HELMET_HEAD_CRIT_REDUCTION, 15);
  assert.equal(applyHelmetHeadCritReduction(35, 'head', true), 20);
  assert.equal(applyHelmetHeadCritReduction(10, 'head', true), 0);
});

test('helmet critical protection only applies to targeted head shots', () => {
  assert.equal(applyHelmetHeadCritReduction(35, 'head', false), 35);
  assert.equal(applyHelmetHeadCritReduction(35, 'torso', true), 35);
  assert.equal(applyHelmetHeadCritReduction(35, 'eyes', true), 35);
  assert.equal(applyHelmetHeadCritReduction(35, null, true), 35);
});

test('Damage Self uses half of maximum weapon damage instead of a random roll', () => {
  assert.equal(criticalFailureSelfDamage({
    damageDieCount: 2,
    damageDie: 6,
    damageBonus: 4,
  }), 8);
  assert.equal(criticalFailureSelfDamage({
    damageDieCount: 1,
    damageDie: 10,
    damageBonus: 1,
  }), 5);
});