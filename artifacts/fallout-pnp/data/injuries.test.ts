import assert from 'node:assert/strict';
import test from 'node:test';
import { computeInjuryEffects, computeInjurySkillPenalty } from './injuries.ts';

const injury = (
  location: 'eyes' | 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg',
  skillPenalty: Record<string, number> = {},
) => ({
  id: location,
  location,
  severity: 'crippled' as const,
  description: `crippled ${location}`,
  toHitPenalty: 0,
  skillPenalty,
  movementPenalty: 0,
  isActive: true,
});

const special = {
  strength: 5,
  perception: 5,
  endurance: 5,
  charisma: 5,
  intelligence: 5,
  agility: 6,
  luck: 5,
};

test('Rabid ignores crippled limb effects in combat and character injury summaries', () => {
  const character = {
    special,
    traits: ['rabid'],
    injuries: [injury('leftArm'), injury('rightLeg')],
  };

  assert.deepEqual(computeInjuryEffects(character), {
    effectivePerception: 5,
    effectiveAgility: 6,
    blind: false,
    crippledArms: 0,
    crippledLegs: 0,
    movementApMultiplier: 1,
    oneHexPerRound: false,
    cannotUseTwoHanded: false,
    cannotUseWeapons: false,
    notes: [],
  });
});

test('Rabid still applies blindness while ignoring crippled limbs', () => {
  const effects = computeInjuryEffects({
    special,
    traits: ['rabid'],
    injuries: [injury('leftArm'), injury('eyes')],
  });

  assert.equal(effects.crippledArms, 0);
  assert.equal(effects.effectiveAgility, 6);
  assert.equal(effects.blind, true);
  assert.equal(effects.effectivePerception, 1);
  assert.ok(effects.notes.some(note => note.includes('Blind')));
});

test('Rabid ignores explicit crippled-limb skill penalties but keeps other injury penalties', () => {
  const character = {
    traits: ['rabid'],
    injuries: [
      injury('leftArm', { repair: -10 }),
      injury('eyes', { repair: -5 }),
    ],
  };
  assert.equal(computeInjurySkillPenalty(character, 'repair'), -5);
  assert.equal(computeInjurySkillPenalty({
    ...character,
    traits: [],
  }, 'repair'), -15);
});
