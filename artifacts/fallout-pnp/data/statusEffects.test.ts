import assert from 'node:assert/strict';
import test from 'node:test';
import type { Character } from '../context/types.ts';
import { clearTemporaryCharacterEffects } from './statusEffects.ts';

function makeCharacter(overrides: Record<string, unknown> = {}): Character {
  return {
    id: 'active-character',
    conditions: ['minorWithdrawal', 'drunk'],
    effects: [
      { id: 'poison', kind: 'other', poisonType: 'B', poisonCount: 2, name: 'Poisoned', isActive: true },
      { id: 'chem', kind: 'chem', chemId: 'jet', name: 'Jet', isActive: true },
    ],
    isKnockedOut: true,
    knockOutRoundsLeft: 3,
    combatDefenseSuppressed: true,
    areaEffects: [{
      id: 'fire',
      kind: 'fire',
      name: 'On fire',
      damageDieCount: 1,
      damageDie: 6,
      damageBonus: 0,
      damageType: 'fire',
      persistent: true,
    }],
    injuries: [{
      id: 'broken-arm',
      location: 'leftArm',
      severity: 'broken',
      description: 'Broken left arm',
      toHitPenalty: 0,
      skillPenalty: {},
      movementPenalty: 0,
      isActive: true,
      source: 'combat',
    }],
    currentHp: 6,
    accumulatedRadiation: 40,
    equippedBodyArmorId: 'combat-armor',
    perks: [{ perkId: 'toughness', rank: 1 }],
    ...overrides,
  } as unknown as Character;
}

test('clears temporary statuses while preserving injuries and persistent character data', () => {
  const character = makeCharacter();
  const cleared = clearTemporaryCharacterEffects(character);

  assert.deepEqual(cleared.effects, []);
  assert.deepEqual(cleared.conditions, []);
  assert.equal(cleared.isKnockedOut, false);
  assert.equal(cleared.knockOutRoundsLeft, 0);
  assert.equal(cleared.combatDefenseSuppressed, false);
  assert.deepEqual(cleared.areaEffects, []);
  assert.deepEqual(cleared.injuries, character.injuries);
  assert.equal(cleared.currentHp, 6);
  assert.equal(cleared.accumulatedRadiation, 40);
  assert.equal(cleared.equippedBodyArmorId, 'combat-armor');
  assert.deepEqual(cleared.perks, character.perks);
  assert.equal(character.isKnockedOut, true);
});

test('healing injuries deactivates them without deleting their history', () => {
  const character = makeCharacter();
  const cleared = clearTemporaryCharacterEffects(character, true);

  assert.equal(cleared.injuries.length, 1);
  assert.equal(cleared.injuries[0].isActive, false);
  assert.equal(cleared.injuries[0].description, 'Broken left arm');
  assert.equal(character.injuries[0].isActive, true);
});
