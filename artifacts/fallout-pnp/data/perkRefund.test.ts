import assert from 'node:assert/strict';
import test from 'node:test';
import { refundPerk } from './perkRefund.ts';

test('refund removes all ranks and per-level acquisition metadata', () => {
  const result = refundPerk([
    { perkId: 'lifegiver', rank: 2, takenAtLevel: 12 },
    { perkId: 'dodger', rank: 1, takenAtLevel: 9 },
  ], 'lifegiver');
  assert.deepEqual(result, {
    perks: [{ perkId: 'dodger', rank: 1, takenAtLevel: 9 }],
    refundedPoints: 2,
  });
});

test('refund of an unowned perk is a no-op', () => {
  const perks = [{ perkId: 'dodger', rank: 1 }];
  assert.deepEqual(refundPerk(perks, 'lifegiver'), { perks, refundedPoints: 0 });
});