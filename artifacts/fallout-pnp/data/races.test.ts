import assert from 'node:assert/strict';
import test from 'node:test';
import type { Character, CustomRaceDefinition, SPECIALStats } from '../context/types.ts';
import {
  BUILT_IN_RACE_TAGS,
  getBuiltInRaceTagId,
  getCharacterRaceDefinition,
  getCharacterRaceTagIds,
  getCustomRaceProfileTagId,
  getSelectableRaceTags,
  validateCustomRace,
} from './races.ts';

const special: SPECIALStats = {
  strength: 5, perception: 5, endurance: 5, charisma: 5,
  intelligence: 5, agility: 5, luck: 5,
};

const synthProfile: CustomRaceDefinition = {
  id: 'race-synth',
  name: 'Synth',
  description: 'Synthetic humanoid.',
  specialMin: { ...special },
  specialMax: { strength: 10, perception: 10, endurance: 10, charisma: 10, intelligence: 10, agility: 10, luck: 10 },
  specialDefault: { ...special },
  naturalDR: 10,
  naturalGasDR: 100,
  naturalElecDR: 25,
  naturalWeaponIds: [],
  benefits: ['Immune to gas'],
  penalties: [],
  playable: true,
  perksPerLevels: 3,
  naturalACBonus: 1,
  bonusHPPerLevel: 1,
  bonusMeleeDamage: 0,
};

test('race tags have stable IDs for every built-in race', () => {
  assert.equal(BUILT_IN_RACE_TAGS.length, 14);
  assert.equal(new Set(BUILT_IN_RACE_TAGS.map(tag => tag.id)).size, BUILT_IN_RACE_TAGS.length);
  assert.equal(getBuiltInRaceTagId('halfMutant'), 'race-half-mutant');
  assert.equal(getBuiltInRaceTagId('superMutant'), 'race-super-mutant');
  assert.notEqual(getBuiltInRaceTagId('halfMutant'), getBuiltInRaceTagId('superMutant'));
});

test('custom race profiles drive character calculations and contribute canonical plus selected tags', () => {
  const character = {
    race: 'customRace',
    customRaceId: synthProfile.id,
    customRaceProfile: synthProfile,
    raceTags: ['race-custom-synth', 'race-cybernetic'],
  } as unknown as Character;

  assert.equal(getCharacterRaceDefinition(character)?.naturalDR, 10);
  assert.deepEqual(getCharacterRaceTagIds(character), [
    'race-custom',
    getCustomRaceProfileTagId(synthProfile.id),
    'race-custom-synth',
    'race-cybernetic',
  ]);
  assert.deepEqual(getCharacterRaceTagIds({ ...character, race: 'human' }), ['race-human']);
});

test('race tag menu combines built-ins, profiles, campaign tags, and selected legacy tags', () => {
  const options = getSelectableRaceTags(
    [synthProfile],
    [{ id: 'race-custom-synth', label: 'Synth' }],
    [],
    ['race-from-old-save'],
  );
  const byId = new Map(options.map(tag => [tag.id, tag.label]));
  assert.equal(byId.get('race-human'), 'Human');
  assert.equal(byId.get(getCustomRaceProfileTagId(synthProfile.id)), 'Synth');
  assert.equal(byId.get('race-custom-synth'), 'Synth');
  assert.equal(byId.get('race-from-old-save'), 'race-from-old-save');
  const importedCharacter = {
    race: 'customRace',
    customRaceId: synthProfile.id,
    customRaceProfile: synthProfile,
    raceTags: [],
  } as unknown as Character;
  const importedProfileTag = getSelectableRaceTags([], [], [importedCharacter])
    .find(tag => tag.id === getCustomRaceProfileTagId(synthProfile.id));
  assert.equal(importedProfileTag?.label, 'Synth');
});

test('custom race profiles validate their ranges and protection parameters', () => {
  assert.equal(validateCustomRace(synthProfile), true);
  assert.equal(validateCustomRace({
    ...synthProfile,
    specialMin: { ...special, strength: 8 },
  }), false);
  assert.equal(validateCustomRace({
    ...synthProfile,
    naturalProtection: {
      dtNormal: 0, dtLaser: 0, dtFire: 0, dtPlasma: 0, dtExplosion: 0,
      drNormal: 0, drLaser: 0, drFire: 0, drPlasma: 0, drExplosion: 101,
    },
  }), false);
});
