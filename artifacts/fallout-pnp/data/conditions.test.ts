import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CONDITION_IDS,
  applyTemporaryDerivedDeltas,
  computeConditionModifiers,
  computeTemporaryDerivedDeltas,
  isHealingBlocked,
  resolveHpChange,
} from './conditions.ts';

test('minor withdrawal applies AGI/PER penalties and blocks healing', () => {
  const char = { conditions: [CONDITION_IDS.minorWithdrawal] };
  assert.deepEqual(computeConditionModifiers(char), {
    statMods: { agility: -1, perception: -1 },
    blocksHealing: true,
    active: [
      {
        id: CONDITION_IDS.minorWithdrawal,
        name: 'Minor Withdrawal',
        description: '−1 Agility, −1 Perception. Cannot heal while active.',
        statMods: { agility: -1, perception: -1 },
        blocksHealing: true,
      },
    ],
  });
  assert.equal(isHealingBlocked(char), true);
});

test('major withdrawal and recovery penalties stack while unknown legacy strings are preserved and ignored', () => {
  const result = computeConditionModifiers({
    conditions: [CONDITION_IDS.majorWithdrawal, 'legacy-condition', CONDITION_IDS.addictionRecovery],
  });
  assert.deepEqual(result.statMods, {
    agility: -3,
    perception: -3,
    endurance: -2,
    strength: -1,
  });
  assert.equal(result.blocksHealing, true);
  assert.equal(result.active.length, 2);
});

test('addiction recovery lowers END without blocking healing', () => {
  const char = { conditions: [CONDITION_IDS.addictionRecovery] };
  assert.deepEqual(computeConditionModifiers(char).statMods, { endurance: -1 });
  assert.equal(isHealingBlocked(char), false);
  assert.equal(resolveHpChange({ ...char, currentHp: 4, maxHp: 10 }, 3), 7);
});

test('healing is blocked but damage still applies and clamps', () => {
  const char = { conditions: [CONDITION_IDS.minorWithdrawal], currentHp: 5, maxHp: 10 };
  assert.equal(resolveHpChange(char, 4), 5);
  assert.equal(resolveHpChange(char, -3), 2);
  assert.equal(resolveHpChange(char, -99), 0);
});

test('working AGI and PER penalties propagate to AP, AC, and Sequence', () => {
  const stored = {
    strength: 5, perception: 5, endurance: 5, charisma: 5,
    intelligence: 5, agility: 5, luck: 5,
  };
  const deltas = computeTemporaryDerivedDeltas(stored, { ...stored, perception: 2, agility: 2 });
  assert.deepEqual(deltas, { maxAP: -1, armorClass: -3, sequence: -6 });
  assert.deepEqual(
    applyTemporaryDerivedDeltas({ maxAP: 7, armorClass: 5, sequence: 10 }, deltas),
    { maxAP: 6, armorClass: 2, sequence: 4 },
  );
});