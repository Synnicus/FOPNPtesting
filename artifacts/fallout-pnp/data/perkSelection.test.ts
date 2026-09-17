import assert from 'node:assert/strict';
import test from 'node:test';
import {
  breakTheRulesPendingAfterPurchase,
  breakTheRulesWaivesRequirements,
} from './breakTheRules.ts';

test('Break the Rules waives requirements and race only for the next different perk', () => {
  assert.equal(breakTheRulesWaivesRequirements(false, 'glowing_one'), false);
  assert.equal(breakTheRulesWaivesRequirements(true, 'glowing_one'), true);
  assert.equal(breakTheRulesWaivesRequirements(true, 'break_the_rules'), false);
});

test('Break the Rules activates on purchase and is consumed by the next purchase', () => {
  assert.equal(breakTheRulesPendingAfterPurchase(undefined, 'break_the_rules'), true);
  assert.equal(breakTheRulesPendingAfterPurchase(true, 'glowing_one'), false);
  assert.equal(breakTheRulesPendingAfterPurchase(undefined, 'pack_rat'), undefined);
});