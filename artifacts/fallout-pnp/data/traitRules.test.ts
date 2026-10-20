import assert from 'node:assert/strict';
import test from 'node:test';
import { applyTightNutsDamageResistance, applyTightNutsRepairHealing, isCriticalFailureRoll } from './traitRules.ts';

test('critical failure probability is 3% normally and exactly 4.5% with Jinxed', () => {
  const normalFailures = Array.from({ length: 100 }, (_, index) => index + 1)
    .filter(roll => isCriticalFailureRoll(roll, false)).length;
  let jinxedFailures = 0;
  for (let roll = 1; roll <= 100; roll += 1) {
    if (roll === 96) {
      jinxedFailures += (
        Number(isCriticalFailureRoll(roll, true, 0.25))
        + Number(isCriticalFailureRoll(roll, true, 0.75))
      ) / 2;
    } else {
      jinxedFailures += Number(isCriticalFailureRoll(roll, true));
    }
  }
  assert.equal(normalFailures, 3);
  assert.equal(jinxedFailures, 4.5);
});

test('Jinxed applies only the half-chance boundary roll', () => {
  assert.equal(isCriticalFailureRoll(96, true, 0.49), true);
  assert.equal(isCriticalFailureRoll(96, true, 0.5), false);
  assert.equal(isCriticalFailureRoll(97, true), true);
  assert.equal(isCriticalFailureRoll(97, false), false);
});

test('Tight Nuts doubles robot base DR only when the trait is selected', () => {
  assert.equal(applyTightNutsDamageResistance(40, 20, 'robot', ['tight_nuts']), 60);
  assert.equal(applyTightNutsDamageResistance(40, 20, 'human', ['tight_nuts']), 40);
  assert.equal(applyTightNutsDamageResistance(40, 20, 'robot', []), 40);
});

test('Tight Nuts halves repair HP only for robots with the trait', () => {
  assert.equal(applyTightNutsRepairHealing(12, 'robot', ['tight_nuts']), 6);
  assert.equal(applyTightNutsRepairHealing(1, 'robot', ['tight nuts']), 0.5);
  assert.equal(applyTightNutsRepairHealing(12, 'human', ['tight_nuts']), 12);
  assert.equal(applyTightNutsRepairHealing(12, 'robot', []), 12);
});
