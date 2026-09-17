import assert from 'node:assert/strict';
import test from 'node:test';
import {
  conditionAfterCriticalFailure,
  CONDITION_BOXES_MAX,
} from './condition.ts';

test('confirming a critical failure fills one weapon condition box', () => {
  assert.equal(conditionAfterCriticalFailure(0), 1);
  assert.equal(conditionAfterCriticalFailure(6), 7);
});

test('critical-failure condition loss cannot exceed fully broken', () => {
  assert.equal(conditionAfterCriticalFailure(9), CONDITION_BOXES_MAX);
  assert.equal(conditionAfterCriticalFailure(10), CONDITION_BOXES_MAX);
});