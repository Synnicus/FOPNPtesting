import assert from 'node:assert/strict';
import test from 'node:test';
import { hasUnsavedCharacterChanges } from './characterDraft.ts';

test('an untouched character draft is not considered changed', () => {
  const character = {
    id: 'character-1',
    name: 'Wanderer',
    special: { strength: 5, perception: 6 },
    traits: ['fast-shot'],
  };
  assert.equal(hasUnsavedCharacterChanges(character, structuredClone(character)), false);
});

test('nested character edits are detected and reverting them clears the dirty state', () => {
  const original = {
    id: 'character-1',
    name: 'Wanderer',
    special: { strength: 5, perception: 6 },
  };
  const edited = {
    ...original,
    special: { ...original.special, strength: 6 },
  };
  assert.equal(hasUnsavedCharacterChanges(original, edited), true);
  assert.equal(hasUnsavedCharacterChanges(original, { ...edited, special: original.special }), false);
});

test('object key insertion order does not count as a character change', () => {
  assert.equal(
    hasUnsavedCharacterChanges(
      { name: 'Wanderer', stats: { strength: 5, agility: 6 } },
      { stats: { agility: 6, strength: 5 }, name: 'Wanderer' },
    ),
    false,
  );
});
