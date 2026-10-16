import assert from 'node:assert/strict';
import test from 'node:test';
import { BUILT_IN_ARMOR } from './armor.ts';
import { resolveArmorAwareSheet } from './armorEffects.ts';
import { BUILT_IN_BESTIARY, spawnBestiaryTemplate } from './bestiary.ts';
import { BUILT_IN_WEAPONS } from './weapons.ts';
import { resolveAreaTarget } from './areaEffects.ts';
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

test('Option 1 and Super Mutant/Deathclaw immunity block radiation without healing, while Half-Mutants stay unchanged', () => {
  const rules = { mutantGhoulRadiationRules: true, ghoulRadiationHealingOption: 1 as const };
  for (const raceId of ['ghoul', 'superMutant', 'deathclaw']) {
    const sheet = resolveArmorAwareSheet({
      special, skills, raceId, radiationResistance: 25,
      ...rules, allArmor: [],
    });
    assert.equal(sheet.radiationResistance, 100, `${raceId} has complete resistance under Option 1`);
    assert.equal(sheet.radiationSicknessImmune, true, `${raceId} is immune to radiation sickness`);
    const gain = applyRadiationGain(
      { accumulatedRadiation: 0, currentHp: 2 },
      resolveRadiationAddition(20, sheet.radiationResistance),
      100,
      sheet.ghoulRadiationHealingDivisor,
    );
    assert.equal(gain.accumulatedRadiation, 0, `${raceId}: no radiation enters the meter`);
    assert.equal(gain.currentHp, 2, `${raceId}: Option 1 grants no radiation healing`);
  }

  const halfMutant = resolveArmorAwareSheet({
    special, skills, raceId: 'halfMutant', radiationResistance: 25,
    mutantGhoulRadiationRules: true, ghoulRadiationHealingOption: 2, allArmor: [],
  });
  assert.equal(halfMutant.radiationResistance, 25);
  assert.equal(halfMutant.radiationSicknessImmune, false);
  assert.equal(halfMutant.ghoulRadiationHealingDivisor, null);
  const halfMutantGain = applyRadiationGain({ accumulatedRadiation: 0, currentHp: 2 }, 20, 100, null);
  assert.equal(halfMutantGain.accumulatedRadiation, 20);
  assert.equal(halfMutantGain.currentHp, 2);
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

test('body armor and a compatible helmet reduce Ghoul radiation before healing options 2–4', () => {
  const body = {
    ...BUILT_IN_ARMOR.find(item => item.id === 'clothing')!,
    id: 'radiation-body-armor',
    effects: { radiationResistance: 20 },
  };
  const helmet = {
    ...BUILT_IN_ARMOR.find(item => item.id === 'leather_cap')!,
    id: 'radiation-helmet',
    compatibleBodyArmorIds: [body.id],
    effects: { radiationResistance: 30 },
  };
  const allArmor = [...BUILT_IN_ARMOR, body, helmet];

  for (const [option, expectedHp] of [[2, 4], [3, 8], [4, 22]] as const) {
    const sheet = resolveArmorAwareSheet({
      special, skills, raceId: 'ghoul', radiationResistance: 60,
      mutantGhoulRadiationRules: true, ghoulRadiationHealingOption: option,
      equippedBodyArmorId: body.id, equippedHelmetId: helmet.id, allArmor,
    });
    assert.equal(sheet.armorEffects.radiationResistance, 50, `option ${option}: worn body and helmet resistance stack`);
    assert.equal(sheet.radiationResistance, 50, `option ${option}: natural Ghoul resistance is replaced, armor remains`);

    let ghoul: Parameters<typeof applyRadiationGain>[0] = {
      accumulatedRadiation: 0, currentHp: 2, ghoulRadiationHealingRemainder: 0,
    };
    for (const rawGain of [20, 20]) {
      const accepted = resolveRadiationAddition(rawGain, sheet.radiationResistance);
      ghoul = applyRadiationGain(
        ghoul, accepted, 100,
        ghoulRadiationHealingDivisor('ghoul', {
          mutantGhoulRadiationRules: true, ghoulRadiationHealingOption: option,
        }),
      );
    }
    assert.equal(ghoul.accumulatedRadiation, 20, `option ${option}: only absorbed radiation reaches the meter`);
    assert.equal(ghoul.currentHp, expectedHp, `option ${option}: separate gains accumulate healing progress`);
  }
});

test('combat radiation is resisted once, heals a Ghoul from applied exposure, and caps at the accepted meter amount', () => {
  const body = {
    ...BUILT_IN_ARMOR.find(item => item.id === 'clothing')!,
    id: 'combat-radiation-body',
    effects: { radiationResistance: 20 },
  };
  const helmet = {
    ...BUILT_IN_ARMOR.find(item => item.id === 'leather_cap')!,
    id: 'combat-radiation-helmet',
    compatibleBodyArmorIds: [body.id],
    effects: { radiationResistance: 30 },
  };
  const sheet = resolveArmorAwareSheet({
    special, skills, raceId: 'ghoul', radiationResistance: 60,
    mutantGhoulRadiationRules: true, ghoulRadiationHealingOption: 2,
    equippedBodyArmorId: body.id, equippedHelmetId: helmet.id,
    allArmor: [...BUILT_IN_ARMOR, body, helmet],
  });
  const resolvedCombat = resolveAreaTarget({
    kind: 'explosion',
    rawDamage: 0,
    components: [{
      id: 'radiation-rider', label: 'Radiation rider', type: 'radiation',
      dmgDieCount: 0, dmgDie: 0, dmgBonus: 100,
    }],
  }, {
    id: 'ghoul-target', name: 'Armored Ghoul', endurance: 5,
    gasInhaledResistance: 0, gasContactResistance: 0, electricityResistance: 0,
    dt: 0, dr: 0, radiationResistance: sheet.radiationResistance,
  });

  assert.equal(resolvedCombat.radiationExposure, 50, 'combat resolves body plus helmet resistance');
  const afterCombat = applyRadiationGain(
    { accumulatedRadiation: 0, currentHp: 2 },
    resolvedCombat.radiationExposure ?? 0,
    100,
    sheet.ghoulRadiationHealingDivisor,
  );
  assert.equal(afterCombat.accumulatedRadiation, 50);
  assert.equal(afterCombat.currentHp, 7, 'the already-resisted combat exposure is not resisted a second time');

  const capped = applyRadiationGain(
    { accumulatedRadiation: 999, currentHp: 2 },
    resolvedCombat.radiationExposure ?? 0,
    100,
    1,
  );
  assert.equal(capped.accumulatedRadiation, 1000);
  assert.equal(capped.currentHp, 3, 'healing is awarded only for the one point that fit under the meter cap');
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
