import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateMouseDragScrollOffset,
  shouldStartVerticalMouseDrag,
  shouldSuppressClickAfterMouseDrag,
} from './mouseDragScroll.ts';

test('mouse drag scrolls vertically in the expected direction', () => {
  assert.equal(calculateMouseDragScrollOffset(100, -40, 300, 900), 140);
  assert.equal(calculateMouseDragScrollOffset(100, 40, 300, 900), 60);
});

test('mouse drag offsets stay within the content bounds', () => {
  assert.equal(calculateMouseDragScrollOffset(0, 20, 300, 900), 0);
  assert.equal(calculateMouseDragScrollOffset(560, -50, 300, 900), 600);
  assert.equal(calculateMouseDragScrollOffset(0, -50, 300, 200), 0);
});

test('only vertical movement beyond the drag threshold starts mouse scrolling', () => {
  assert.equal(shouldStartVerticalMouseDrag(0, 5), false);
  assert.equal(shouldStartVerticalMouseDrag(2, 8), true);
  assert.equal(shouldStartVerticalMouseDrag(12, 4), false);
});

test('only the immediate click after a mouse drag is suppressed', () => {
  assert.equal(shouldSuppressClickAfterMouseDrag(1000, 1000), true);
  assert.equal(shouldSuppressClickAfterMouseDrag(1000, 1300), true);
  assert.equal(shouldSuppressClickAfterMouseDrag(1000, 1400), false);
  assert.equal(shouldSuppressClickAfterMouseDrag(0, 1000), false);
});
