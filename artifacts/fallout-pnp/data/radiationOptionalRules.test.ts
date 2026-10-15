import assert from 'node:assert/strict';
import test from 'node:test';
import { BUILT_IN_ARMOR } from './armor.ts';
import { resolveArmorAwareSheet } from './armorEffects.ts';
import { BUILT_IN_BESTIARY, spawnBestiaryTemplate } from './bestiary.ts';
import { BUILT_IN_WEAPONS } from './weapons.ts';
import {
  applyRadiationGain,
  ghoulRadiationHealingDivisor,
  isRadiationResistanceLocked,
  isRadiationSicknessImmune,
  radiationSicknessEffect,
  radiationSicknessLabel,
  resolveRadiationAddition,
} from './radiation.ts';

const special = { strength: 5, perception: 5, endurance: 5, charisma: 5, intelligence: 5, agility: 5, luck: 5 };
const skills = {
  smallGuns: 20, bigGuns: 20, energyWeapons: 20, meleeWeapons: 20, unarmed: 20, throwing: 20,
  firstAid: 20, doctor: 20, sneak: 20, lockpick: 20, steal: 20, traps: 20,
  science: 20, repair: 20, speech: 20, barter: 20, gambling: 20, outdoorsman: 20, pilot: 20,
};
const ghoulRules = { mutantGhoulRadiationRules: true, ghoulRadiationHealingOption: 2 as const };

test('radiation-immune races suppress sickness and Hardcore radiation penalties', () => {
  assert.equal(isRadiationSicknessImmune('superMutant', ghoulRules), true);
  assert.equal(isRadiationSicknessImmune('deathclaw', ghoulRules), true);
  assert.equal(isRadiationSicknessImmune('ghoul', ghoulRules), true);
  assert.equal(isRadiationSicknessImmune('halfMutant', ghoulRules), false);
  assert.equal(radiationSicknessEffect(800, true), null);
  assert.equal(radiationSicknessLabel(800, true), 'Radiation-Immune');

  const sheet = resolveArmorAwareSheet({
    special, skills, radiationResistance: 60, raceId: 'superMutant',
    mutantGhoulRadiationRules: true, ghoulRadiationHealingOption: 2,
    accumulatedRadiation: 500, hardcoreRadiationRules: true, allArmor: [],
  });
  assert.equal(sheet.radiationResistance, 100);
  assert.equal(sheet.radiationSicknessImmune, true);
  assert.equal(sheet.effectiveSpecial.strength, special.strength);
});

test('Ghoul healing options override natural resistance but retain worn armor resistance', () => {
  const powerArmor = BUILT_IN_ARMOR.find(item => item.id === 'power_armor');
  assert.ok(powerArmor);
  const ghoulSheet = resolveArmorAwareSheet({
    special, skills, radiationResistance: 60, raceId: 'ghoul',
    mutantGhoulRadiationRules: true, ghoulRadiationHealingOption: 2,
    equippedBodyArmorId: powerArmor.id, allArmor: [powerArmor],
  });
  assert.equal(ghoulSheet.radiationResistance, 30);
  assert.equal(ghoulSheet.ghoulRadiationHealingDivisor, 10);

  const normalGhoul = resolveArmorAwareSheet({
    special, skills, radiationResistance: 60, raceId: 'ghoul',
    allArmor: [],
  });
  assert.equal(normalGhoul.radiationResistance, 60);
  assert.equal(ghoulRadiationHealingDivisor('ghoul', {
    mutantGhoulRadiationRules: true, ghoulRadiationHealingOption: 3,
  }), 3);
  assert.equal(ghoulRadiationHealingDivisor('ghoul', {
    mutantGhoulRadiationRules: true, ghoulRadiationHealingOption: 4,
  }), 1);
  assert.equal(ghoulRadiationHealingDivisor('ghoul', {
    mutantGhoulRadiationRules: true, ghoulRadiationHealingOption: 1,
  }), null);
  assert.equal(isRadiationResistanceLocked('ghoul', {
    mutantGhoulRadiationRules: true, ghoulRadiationHealingOption: 1,
  }), true);
  assert.equal(isRadiationResistanceLocked('halfMutant', ghoulRules), false);

  const ghoulImmune = resolveArmorAwareSheet({
    special, skills, radiationResistance: 60, raceId: 'ghoul',
    mutantGhoulRadiationRules: true, ghoulRadiationHealingOption: 1, allArmor: [],
  });
  assert.equal(ghoulImmune.radiationResistance, 100);
  assert.equal(ghoulImmune.radiationSicknessImmune, true);
  assert.equal(ghoulImmune.ghoulRadiationHealingDivisor, null);
});

test('ghoul healing uses only newly accumulated radiation, carries remainders, and respects the meter cap', () => {
  const twoRads = applyRadiationGain(
    { accumulatedRadiation: 0, currentHp: 4 }, 2, 10, 3,
  );
  assert.deepEqual(twoRads, { accumulatedRadiation: 2, currentHp: 4, ghoulRadiationHealingRemainder: 2 });
  const thirdRad = applyRadiationGain(twoRads, 1, 10, 3);
  assert.deepEqual(thirdRad, { accumulatedRadiation: 3, currentHp: 5, ghoulRadiationHealingRemainder: 0 });

  const atCap = applyRadiationGain(
    { accumulatedRadiation: 999, currentHp: 4 }, 10, 10, 1,
  );
  assert.equal(atCap.accumulatedRadiation, 1000);
  assert.equal(atCap.currentHp, 5);

  const resistanceApplied = resolveRadiationAddition(20, 30);
  assert.equal(resistanceApplied, 14);
  assert.equal(applyRadiationGain({ accumulatedRadiation: 0, currentHp: 4 }, resistanceApplied, 10, 1).currentHp, 10);
  assert.equal(applyRadiationGain({ accumulatedRadiation: 0, currentHp: 4 }, 20, 10, null).currentHp, 4);
});

test('pre-made Ghoul, Super Mutant, and Deathclaw templates spawn as their race without losing printed resistances', () => {
  const eligible = BUILT_IN_BESTIARY.filter(template =>
    template.race === 'ghoul' || template.race === 'superMutant' || template.id === 'deathclaw',
  );
  assert.ok(eligible.length > 0);
  for (const template of eligible) {
    const expectedRace = template.race ?? 'deathclaw';
    assert.equal(template.race, expectedRace, template.id);
    const spawned = spawnBestiaryTemplate(template, BUILT_IN_WEAPONS, template.name, `race-${template.id}`);
    assert.equal(spawned.race, expectedRace, template.id);
    assert.equal(spawned.radiationResistance, template.radiationResistance, `${template.id} radiation resistance`);
    assert.equal(spawned.gasResistance, template.gasResistance, `${template.id} gas resistance`);
    assert.deepEqual(spawned.naturalProtection, template.naturalProtection, `${template.id} natural protection`);
  }

  const floater = BUILT_IN_BESTIARY.find(template => template.id === 'floater');
  assert.ok(floater);
  assert.equal(floater.race, undefined);
  assert.equal(spawnBestiaryTemplate(floater, BUILT_IN_WEAPONS, floater.name, 'floater-test').race, 'customRace');
});
