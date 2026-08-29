import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ALCOHOL_CONSUMABLES,
  CHEMS,
  getAlcoholConsumable,
  getChem,
} from './chems.ts';
import {
  CONDITION_IDS,
  computeConditionModifiers,
  getConditionDefinition,
} from './conditions.ts';

test('manual alcohol data links to the explicitly controlled Drunk condition', () => {
  assert.deepEqual(ALCOHOL_CONSUMABLES.map(item => item.name), ['Alcohol']);

  const alcohol = getAlcoholConsumable('alcohol');
  assert.ok(alcohol);
  assert.equal(alcohol.conditionId, CONDITION_IDS.drunk);
  assert.equal(alcohol.application, 'user-or-gm-controlled');

  const drunk = getConditionDefinition(alcohol.conditionId);
  assert.ok(drunk);
  assert.equal(drunk.name, 'Drunk');
  assert.equal(drunk.control, 'user-or-gm');
});

test('Drunk has no invented penalties, healing restriction, or duration', () => {
  const drunk = getConditionDefinition(CONDITION_IDS.drunk);
  assert.ok(drunk);
  assert.deepEqual(drunk.statMods, {});
  assert.equal(drunk.blocksHealing, false);
  assert.equal('duration' in drunk, false);
  assert.equal('durationText' in drunk, false);

  assert.deepEqual(computeConditionModifiers({ conditions: [CONDITION_IDS.drunk] }), {
    statMods: {},
    blocksHealing: false,
    active: [drunk],
  });
});

test('alcohol remains separate from existing chem effects and lookups', () => {
  const existingChemCount = CHEMS.length;
  assert.equal(getChem('alcohol'), undefined);
  assert.equal(getAlcoholConsumable('jet'), undefined);
  assert.equal(CHEMS.length, existingChemCount);
  assert.deepEqual(getChem('jet')?.stages[0].statMods, { strength: 1, perception: 1 });
});

test('unknown legacy condition strings remain ignored alongside Drunk', () => {
  const result = computeConditionModifiers({
    conditions: ['legacy-condition', CONDITION_IDS.drunk],
  });
  assert.deepEqual(result.statMods, {});
  assert.equal(result.blocksHealing, false);
  assert.deepEqual(result.active.map(condition => condition.id), [CONDITION_IDS.drunk]);
});