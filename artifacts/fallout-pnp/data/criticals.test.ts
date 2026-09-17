import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyHelmetHeadCritReduction,
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