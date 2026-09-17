import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearUnconsciousness,
  DEFAULT_MANUAL_UNCONSCIOUS_ROUNDS,
  setUnconsciousness,
} from './unconsciousness.ts';

test('unconsciousness can be manually added with a one-round default', () => {
  const character = { id: 'test', isKnockedOut: false, knockOutRoundsLeft: 0 };
  assert.deepEqual(setUnconsciousness(character), {
    id: 'test',
    isKnockedOut: true,
    knockOutRoundsLeft: DEFAULT_MANUAL_UNCONSCIOUS_ROUNDS,
  });
});

test('clearing unconsciousness resets both the status and its round counter', () => {
  const character = { id: 'test', isKnockedOut: true, knockOutRoundsLeft: 4 };
  assert.deepEqual(clearUnconsciousness(character), {
    id: 'test',
    isKnockedOut: false,
    knockOutRoundsLeft: 0,
  });
});