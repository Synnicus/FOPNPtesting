import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isCustomConsumableRecord,
  sanitizeCustomConsumables,
  validateCustomConsumable,
} from './consumables.ts';
import type { CustomConsumable } from '../context/types.ts';

const example: CustomConsumable = {
  id: 'custom-tonic',
  name: 'Sunset Tonic',
  category: 'drink',
  value: 25,
  description: 'A bitter homemade drink.',
  effectText: 'The GM decides whether it has any mechanical effect.',
  isCustom: true,
};

test('custom consumables accept valid catalog entries and reject duplicate names', () => {
  assert.equal(isCustomConsumableRecord(example), true);
  assert.deepEqual(validateCustomConsumable(example), []);
  assert.ok(validateCustomConsumable({ ...example, id: 'another-tonic' }, [example]).length > 0);
});

test('custom consumables validate category, caps value, and text limits', () => {
  assert.equal(isCustomConsumableRecord({ ...example, category: 'weapon' }), false);
  assert.equal(isCustomConsumableRecord({ ...example, value: -1 }), false);
  assert.equal(isCustomConsumableRecord({ ...example, value: 1.5 }), false);
  assert.equal(isCustomConsumableRecord({ ...example, effectText: 'x'.repeat(4001) }), false);
});

test('custom consumable sanitization keeps unique valid entries and marks them custom', () => {
  const restored = sanitizeCustomConsumables([
    { ...example, isCustom: undefined },
    { ...example, id: 'duplicate-name' },
    { ...example, id: 'bad-category', category: 'ammo' },
  ]);

  assert.equal(restored.length, 1);
  assert.equal(restored[0].isCustom, true);
  assert.equal(restored[0].id, example.id);
});
