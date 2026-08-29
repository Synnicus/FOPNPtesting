import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyImmediateTraitSpecial,
  applyNightPersonSpecial,
  calculateCarryWeight,
  calculateEffectiveSkills,
  calculateRebasedEffectiveSkills,
  calculateEffectiveSpecial,
  calculateHealingRate,
  calculateMaxActionPoints,
  calculateNaturalArmorClass,
  calculatePerkCadence,
  calculateRadiationResistance,
  calculateSequence,
  calculateSkillPointsPerLevel,
  calculateTagSkillRules,
  fastShotAppliesToSkill,
  replaceStoredNaturalArmorClass,
} from './effectiveRules.ts';

const BASE_SPECIAL = {
  strength: 5,
  perception: 5,
  endurance: 6,
  charisma: 5,
  intelligence: 5,
  agility: 5,
  luck: 5,
};

test('immediate trait SPECIAL rules compose without mutating stored SPECIAL', () => {
  const stored = { ...BASE_SPECIAL };
  const effective = applyImmediateTraitSpecial(stored, [
    'Small Frame',
    'bruiser',
    'gifted',
    'Tech-Wizard',
    'domesticated',
  ]);

  assert.deepEqual(stored, BASE_SPECIAL);
  assert.deepEqual(effective, {
    strength: 8,
    perception: 5,
    endurance: 7,
    charisma: 6,
    intelligence: 7,
    agility: 7,
    luck: 6,
  });
});

test('Night Person adjusts only PER/IN and clamps each to racial bounds', () => {
  const bounds = {
    min: { ...BASE_SPECIAL, perception: 4, intelligence: 2 },
    max: { ...BASE_SPECIAL, perception: 6, intelligence: 7 },
  };
  const high = { ...BASE_SPECIAL, perception: 6, intelligence: 7 };
  const low = { ...BASE_SPECIAL, perception: 4, intelligence: 2 };

  assert.deepEqual(
    applyNightPersonSpecial(high, ['night_person'], 'night', bounds),
    high,
  );
  assert.deepEqual(
    applyNightPersonSpecial(low, ['Night Person'], 'day', bounds),
    low,
  );
  assert.deepEqual(
    applyNightPersonSpecial(BASE_SPECIAL, [], 'night', bounds),
    BASE_SPECIAL,
  );
});

test('effective SPECIAL composes immediate Gifted before bounded Night Person', () => {
  const result = calculateEffectiveSpecial({
    special: BASE_SPECIAL,
    traits: ['gifted', 'night_person'],
    nightPersonPeriod: 'night',
    racialBounds: {
      min: { ...BASE_SPECIAL, perception: 1, intelligence: 1 },
      max: { ...BASE_SPECIAL, perception: 6, intelligence: 6 },
    },
  });
  assert.equal(result.perception, 6);
  assert.equal(result.intelligence, 6);
  assert.equal(result.strength, 6);
});

test('carry weight uses working STR and Small Frame formula', () => {
  assert.equal(calculateCarryWeight(8), 225);
  assert.equal(calculateCarryWeight(8, ['small_frame']), 120);
});

test('Bruiser lowers max AP after working agility is used', () => {
  assert.equal(calculateMaxActionPoints(7), 8);
  assert.equal(calculateMaxActionPoints(7, ['bruiser']), 6);
});

test('Kamikaze removes agility AC but retains racial and Vat Skin AC', () => {
  assert.equal(calculateNaturalArmorClass(8, [], 2), 10);
  assert.equal(calculateNaturalArmorClass(8, ['kamikaze', 'vat_skin'], 2), 12);
});

test('effective AC replaces Gain Agility exactly once and lets Kamikaze remove it', () => {
  // Stored AC = 10 armor + 6 permanent AGI (5 base + Gain Agility) + 2 racial.
  assert.equal(replaceStoredNaturalArmorClass(18, 6, 6, [], 2), 18);
  assert.equal(replaceStoredNaturalArmorClass(18, 6, 6, ['kamikaze'], 2), 12);
});

test('Fast Shot includes thrown weapons but excludes HtH and Melee Weapons', () => {
  assert.equal(fastShotAppliesToSkill('throwing'), true);
  assert.equal(fastShotAppliesToSkill('smallGuns'), true);
  assert.equal(fastShotAppliesToSkill('unarmed'), false);
  assert.equal(fastShotAppliesToSkill('meleeWeapons'), false);
});

test('Kamikaze adds five Sequence and composes with current bonuses', () => {
  assert.equal(calculateSequence(7), 14);
  assert.equal(calculateSequence(7, ['kamikaze'], 2), 21);
});

test('healing and radiation rules compose trait, perk, and current-state bonuses', () => {
  assert.equal(calculateHealingRate(8, ['fast_metabolism'], -1, 4), 7);
  assert.equal(calculateRadiationResistance(60, ['glowing_one'], -10), 100);
  assert.equal(calculateRadiationResistance(60, ['fast_metabolism']), 60);
});

test('effective skills apply Gifted, Skilled, Good Natured, Ham Fisted, and Tech Wizard', () => {
  const stored = {
    smallGuns: 25,
    bigGuns: 30,
    throwing: 30,
    firstAid: 30,
    doctor: 30,
    speech: 30,
    barter: 30,
    repair: 30,
    science: 30,
    lockpick: 30,
    unarmed: 30,
  };
  const effective = calculateEffectiveSkills(stored, {
    traits: ['gifted', 'skilled', 'good_natured', 'ham_fisted', 'tech_wizard'],
  });

  assert.deepEqual(stored, {
    smallGuns: 25, bigGuns: 30, throwing: 30, firstAid: 30, doctor: 30,
    speech: 30, barter: 30, repair: 30, science: 30, lockpick: 30, unarmed: 30,
  });
  assert.equal(effective.smallGuns, 0);
  assert.equal(effective.bigGuns, 20);
  assert.equal(effective.throwing, 30);
  assert.equal(effective.firstAid, 30);
  assert.equal(effective.doctor, 30);
  assert.equal(effective.speech, 50);
  assert.equal(effective.barter, 50);
  assert.equal(effective.repair, 25);
  assert.equal(effective.science, 25);
  assert.equal(effective.lockpick, 25);
});

test('Ham Fisted penalties cannot reduce a skill below zero', () => {
  assert.equal(
    calculateEffectiveSkills({ repair: 5 }, { traits: ['ham_fisted'] }).repair,
    0,
  );
});

test('effective skills preserve purchases while rebasing immediate SPECIAL bases', () => {
  const saved = { smallGuns: 30, unarmed: 20 };
  const effective = calculateRebasedEffectiveSkills({
    savedSkills: saved,
    savedBaseSkills: { smallGuns: 25, unarmed: 15 },
    effectiveBaseSkills: { smallGuns: 29, unarmed: 19 },
    options: { traits: ['gifted'], taggedSkills: ['unarmed'], includeTagBonus: true },
  });
  // The five purchased points survive the SPECIAL rebase; trait/tag layers
  // remain display-only and never alter the saved values.
  assert.deepEqual(saved, { smallGuns: 30, unarmed: 20 });
  assert.deepEqual(effective, { smallGuns: 24, unarmed: 34 });
});

test('Drunken Master grants Unarmed only while drunk and optionally composes with tags', () => {
  const skills = { unarmed: 60, meleeWeapons: 60 };
  assert.deepEqual(
    calculateEffectiveSkills(skills, {
      perks: [{ perkId: 'drunken_master', rank: 1 }],
      conditions: ['Drunk'],
      taggedSkills: ['unarmed'],
      includeTagBonus: true,
    }),
    { unarmed: 100, meleeWeapons: 60 },
  );
  assert.equal(
    calculateEffectiveSkills(skills, {
      perks: ['drunken-master'],
      conditions: [],
    }).unarmed,
    60,
  );
});

test('Beta Software expands normal tag capacity and Ham Fisted adds free Unarmed', () => {
  assert.deepEqual(calculateTagSkillRules(), {
    selectableCapacity: 3,
    freeTagSkills: [],
    totalCapacity: 3,
  });
  assert.deepEqual(calculateTagSkillRules(['beta_software', 'ham_fisted']), {
    selectableCapacity: 4,
    freeTagSkills: ['unarmed'],
    totalCapacity: 5,
  });
});

test('skill points per level use working INT with Gifted and Skilled deltas', () => {
  assert.equal(calculateSkillPointsPerLevel(6), 17);
  assert.equal(calculateSkillPointsPerLevel(6, ['gifted']), 12);
  assert.equal(calculateSkillPointsPerLevel(6, ['skilled']), 22);
  assert.equal(calculateSkillPointsPerLevel(6, ['gifted', 'skilled']), 17);
});

test('perk cadence applies Fear the Reaper before Skilled', () => {
  assert.equal(calculatePerkCadence(4), 4);
  assert.equal(calculatePerkCadence(4, ['skilled']), 5);
  assert.equal(calculatePerkCadence(4, ['fear_the_reaper']), 3);
  assert.equal(calculatePerkCadence(4, ['Fear the Reaper', 'Skilled']), 4);
});