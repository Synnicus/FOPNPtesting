import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applySkillPointOperation,
  canChangeSkillTags,
  rebaseSkillValue,
  reconcileUnspentSkillPoints,
} from './skillAdvancement.ts';

test('normal skill spends one point for +1%', () => {
  assert.deepEqual(
    applySkillPointOperation({
      currentValue: 40,
      baseValue: 35,
      unspentSkillPoints: 3,
      tagged: false,
      direction: 1,
    }),
    { skillValue: 41, unspentSkillPoints: 2, changed: true },
  );
});

test('tagged skill spends one point for +2%', () => {
  assert.deepEqual(
    applySkillPointOperation({
      currentValue: 40,
      baseValue: 35,
      unspentSkillPoints: 3,
      tagged: true,
      direction: 1,
    }),
    { skillValue: 42, unspentSkillPoints: 2, changed: true },
  );
});

test('tagged refund reverses one +2% operation and refunds one point', () => {
  assert.deepEqual(
    applySkillPointOperation({
      currentValue: 42,
      baseValue: 40,
      unspentSkillPoints: 0,
      tagged: true,
      direction: -1,
    }),
    { skillValue: 40, unspentSkillPoints: 1, changed: true },
  );
});

test('refund cannot cross below base, including legacy odd tagged offsets', () => {
  assert.deepEqual(
    applySkillPointOperation({
      currentValue: 41,
      baseValue: 40,
      unspentSkillPoints: 0,
      tagged: true,
      direction: -1,
    }),
    { skillValue: 40, unspentSkillPoints: 1, changed: true },
  );
  assert.equal(
    applySkillPointOperation({
      currentValue: 40,
      baseValue: 40,
      unspentSkillPoints: 0,
      tagged: true,
      direction: -1,
    }).changed,
    false,
  );
});

test('skill cannot increase without an unspent point', () => {
  assert.equal(
    applySkillPointOperation({
      currentValue: 40,
      baseValue: 35,
      unspentSkillPoints: 0,
      tagged: true,
      direction: 1,
    }).changed,
    false,
  );
});

test('tag changes are locked after tagged or untagged allocations to conserve points', () => {
  const taggedPurchase = applySkillPointOperation({
    currentValue: 40,
    baseValue: 40,
    unspentSkillPoints: 1,
    tagged: true,
    direction: 1,
  });
  assert.equal(canChangeSkillTags([taggedPurchase.skillValue], [40]), false);
  const taggedRefund = applySkillPointOperation({
    currentValue: taggedPurchase.skillValue,
    baseValue: 40,
    unspentSkillPoints: taggedPurchase.unspentSkillPoints,
    tagged: true,
    direction: -1,
  });
  assert.deepEqual(taggedRefund, { skillValue: 40, unspentSkillPoints: 1, changed: true });
  assert.equal(canChangeSkillTags([taggedRefund.skillValue], [40]), true);

  const normalPurchase = applySkillPointOperation({
    currentValue: 40,
    baseValue: 40,
    unspentSkillPoints: 1,
    tagged: false,
    direction: 1,
  });
  assert.equal(canChangeSkillTags([normalPurchase.skillValue], [40]), false);
  const normalRefund = applySkillPointOperation({
    currentValue: normalPurchase.skillValue,
    baseValue: 40,
    unspentSkillPoints: normalPurchase.unspentSkillPoints,
    tagged: false,
    direction: -1,
  });
  assert.deepEqual(normalRefund, { skillValue: 40, unspentSkillPoints: 1, changed: true });
  assert.equal(canChangeSkillTags([normalRefund.skillValue], [40]), true);
  assert.equal(canChangeSkillTags([40, 55], [40, 55]), true);
});

test('a race-induced base increase preserves a tagged purchase and its lock', () => {
  const purchase = applySkillPointOperation({
    currentValue: 40,
    baseValue: 40,
    unspentSkillPoints: 1,
    tagged: true,
    direction: 1,
  });
  const newBase = 50;
  const rebasedValue = rebaseSkillValue(purchase.skillValue, 40, newBase);
  assert.equal(rebasedValue, 52);
  assert.equal(canChangeSkillTags([rebasedValue], [newBase]), false);

  const refund = applySkillPointOperation({
    currentValue: rebasedValue,
    baseValue: newBase,
    unspentSkillPoints: purchase.unspentSkillPoints,
    tagged: true,
    direction: -1,
  });
  assert.deepEqual(refund, { skillValue: newBase, unspentSkillPoints: 1, changed: true });
  assert.equal(canChangeSkillTags([refund.skillValue], [newBase]), true);
});

test('a lower-Intelligence race changes the pool without changing points already spent', () => {
  // Human INT 5 at level 1: 15 total, one point spent.
  const reconciled = reconcileUnspentSkillPoints(14, 15, 13);
  assert.equal(reconciled, 12);
  assert.equal(13 - reconciled, 1);

  // Refunding that one purchase returns to the full new pool, not beyond it.
  assert.equal(reconciled + 1, 13);
});

test('pool reductions preserve overspend debt so refunds cannot mint points', () => {
  const oldBase = 40;
  const purchasedValue = oldBase + 15;
  let unspent = reconcileUnspentSkillPoints(0, 15, 13);
  let skillValue = purchasedValue;
  assert.equal(unspent, -2);

  for (let i = 0; i < 15; i += 1) {
    const refund = applySkillPointOperation({
      currentValue: skillValue,
      baseValue: oldBase,
      unspentSkillPoints: unspent,
      tagged: false,
      direction: -1,
    });
    assert.equal(refund.changed, true);
    skillValue = refund.skillValue;
    unspent = refund.unspentSkillPoints;
  }

  assert.equal(skillValue, oldBase);
  assert.equal(unspent, 13);
  assert.equal(canChangeSkillTags([skillValue], [oldBase]), true);
});