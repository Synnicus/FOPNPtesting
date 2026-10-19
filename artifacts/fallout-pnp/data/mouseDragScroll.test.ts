import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateMouseDragScrollOffset } from './mouseDragScroll.ts';

test('mouse drag scrolls vertically in the expected direction', () => {
  assert.equal(calculateMouseDragScrollOffset(100, -40, 300, 900), 140);
  assert.equal(calculateMouseDragScrollOffset(100, 40, 300, 900), 60);
});

test('mouse drag offsets stay within the content bounds', () => {
  assert.equal(calculateMouseDragScrollOffset(0, 20, 300, 900), 0);
  assert.equal(calculateMouseDragScrollOffset(560, -50, 300, 900), 600);
  assert.equal(calculateMouseDragScrollOffset(0, -50, 300, 200), 0);
});
