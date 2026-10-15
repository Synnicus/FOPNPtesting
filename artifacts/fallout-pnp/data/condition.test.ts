import assert from 'node:assert/strict';
import test from 'node:test';
import {
  conditionAfterCriticalFailure,
  CONDITION_BOXES_MAX,
  markConditionSemanticsV2,
  migrateConditionSemantics,
} from './condition.ts';
import type { Character } from '../context/types.ts';

test('confirming a critical failure fills one weapon condition box', () => {
  assert.equal(conditionAfterCriticalFailure(0), 1);
  assert.equal(conditionAfterCriticalFailure(6), 7);
});

test('critical-failure condition loss cannot exceed fully broken', () => {
  assert.equal(conditionAfterCriticalFailure(9), CONDITION_BOXES_MAX);
  assert.equal(conditionAfterCriticalFailure(10), CONDITION_BOXES_MAX);
});

const characterWithCondition = (conditionBoxes: number) => ({
  id: 'premade',
  weaponAmmoStates: [{ weaponId: '10mm_pistol', currentAmmo: 12, conditionBoxes }],
} as Character);

test('new app state preserves pristine premade weapons through the first reload', () => {
  const freshState = markConditionSemanticsV2({
    characters: [characterWithCondition(0)],
  });

  const reloaded = migrateConditionSemantics(freshState);
  assert.equal(reloaded.conditionSemanticsV2, true);
  assert.equal(reloaded.characters?.[0].weaponAmmoStates?.[0].conditionBoxes, 0);
});

test('legacy remaining-box saves still migrate once to filled-box semantics', () => {
  const migrated = migrateConditionSemantics({
    characters: [characterWithCondition(0), characterWithCondition(5)],
  });

  assert.deepEqual(
    migrated.characters?.map(character => character.weaponAmmoStates?.[0].conditionBoxes),
    [10, 0],
  );
  assert.deepEqual(
    migrateConditionSemantics(migrated).characters?.map(character => character.weaponAmmoStates?.[0].conditionBoxes),
    [10, 0],
  );
});
