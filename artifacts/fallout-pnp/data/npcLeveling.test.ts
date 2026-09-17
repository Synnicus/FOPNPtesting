import assert from 'node:assert/strict';
import test from 'node:test';
import { calcNpcMaxHP } from './derived.ts';

test('NPC max HP grows from its printed level-1 health when leveled', () => {
  const special = {
    strength: 5,
    perception: 5,
    endurance: 6,
    charisma: 5,
    intelligence: 5,
    agility: 5,
    luck: 5,
  };

  assert.equal(calcNpcMaxHP(40, special, 1), 40);
  assert.equal(calcNpcMaxHP(40, special, 2), 44);
  assert.equal(calcNpcMaxHP(40, special, 5), 56);
});