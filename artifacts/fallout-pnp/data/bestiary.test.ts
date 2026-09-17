import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveArmorAwareSheet } from './armorEffects.ts';
import {
  MANUAL_BESTIARY as BUILT_IN_BESTIARY,
  EXPECTED_MANUAL_BESTIARY_IDS,
  RESTORED_BESTIARY,
  spawnBestiaryTemplate,
} from './bestiary.ts';
import { BUILT_IN_ARMOR } from './armor.ts';
import { BUILT_IN_WEAPONS, isMeleeWeapon, isRangedWeapon } from './weapons.ts';
import { baseCritChance } from './criticals.ts';

const byId = (id: string) => {
  const template = BUILT_IN_BESTIARY.find(candidate => candidate.id === id);
  assert.ok(template, `missing bestiary template ${id}`);
  return template;
};

const weaponById = (id: string) => {
  const weapon = BUILT_IN_WEAPONS.find(candidate => candidate.id === id);
  assert.ok(weapon, `missing weapon ${id}`);
  return weapon;
};

test('manual bestiary is complete, ordered, and uniquely identified', () => {
  assert.equal(BUILT_IN_BESTIARY.length, 26);
  assert.deepEqual(BUILT_IN_BESTIARY.map(template => template.id), [...EXPECTED_MANUAL_BESTIARY_IDS]);
  assert.equal(new Set(BUILT_IN_BESTIARY.map(template => template.id)).size, BUILT_IN_BESTIARY.length);
  assert.equal(new Set(BUILT_IN_BESTIARY.map(template => template.name)).size, BUILT_IN_BESTIARY.length);
});

test('manual catalog contains no scaling, placeholder, or approximation labels', () => {
  for (const template of BUILT_IN_BESTIARY) {
    const searchable = `${template.name} ${template.description ?? ''}`.toLowerCase();
    assert.doesNotMatch(searchable, /\b(approx|approximate|scaled|placeholder|invented|young|alpha|mother|elder|baby)\b/);
  }
});

test('every natural attack references an exact built-in weapon profile', () => {
  for (const template of BUILT_IN_BESTIARY) {
    assert.ok(template.naturalAttacks?.length, `${template.name} has no natural attacks`);
    assert.equal(template.equippedWeaponId, template.naturalAttacks[0].weaponId);
    for (const attack of template.naturalAttacks) {
      const weapon = weaponById(attack.weaponId);
      assert.equal(weapon.category, 'natural', `${template.name}/${weapon.name} is not natural`);
      assert.ok(attack.hitChance > 0, `${template.name}/${weapon.name} has no printed hit chance`);
      assert.ok((weapon.apSingle ?? 0) > 0, `${template.name}/${weapon.name} has no AP cost`);
      assert.ok(weapon.damageDieCount > 0 && weapon.damageDie > 0, `${template.name}/${weapon.name} has no damage dice`);
    }
  }
});

test('Unarmed equals the rounded average printed attack chance', () => {
  for (const template of BUILT_IN_BESTIARY) {
    const attacks = template.naturalAttacks ?? [];
    const average = Math.round(attacks.reduce((sum, attack) => sum + attack.hitChance, 0) / attacks.length);
    assert.equal(template.skills.unarmed, average, template.name);
  }
});

test('all 26 printed core stat and resistance rows match the manual', () => {
  const expected: Record<string, [number, number, number, number, number, number, number, number, number]> = {
    giant_rat: [10, 6, 6, 25, 3, 5, 50, 20, 0],
    rad_rat: [10, 6, 6, 35, 3, 5, 60, 100, 0],
    lesser_molerat: [15, 7, 7, 100, 3, 9, 50, 25, 0],
    greater_molerat: [30, 9, 9, 400, 5, 12, 60, 25, 0],
    lesser_pigrat: [20, 7, 7, 200, 4, 10, 50, 30, 0],
    greater_pigrat: [30, 9, 9, 450, 6, 14, 70, 45, 0],
    giant_cockroaches: [15, 6, 6, 50, 4, 5, 100, 95, 80],
    giant_ants: [15, 6, 6, 50, 3, 2, 100, 60, 60],
    mantis: [10, 7, 7, 50, 2, 5, 75, 80, 60],
    brahmin: [40, 6, 6, 50, 2, 5, 20, 30, 0],
    floater: [60, 9, 9, 500, 8, 20, 80, 80, 100],
    crawler: [60, 9, 9, 600, 7, 20, 90, 80, 100],
    flailer: [60, 9, 9, 750, 8, 25, 95, 100, 100],
    centaur: [60, 9, 9, 750, 8, 25, 50, 80, 40],
    lesser_radscorpion: [25, 8, 8, 200, 4, 7, 100, 25, 30],
    greater_radscorpion: [35, 8, 8, 400, 5, 10, 100, 50, 50],
    grey_wolf: [20, 6, 6, 100, 5, 5, 25, 15, 0],
    dire_wolf: [60, 9, 9, 700, 7, 9, 40, 20, 0],
    coyote: [20, 6, 6, 100, 5, 3, 20, 10, 0],
    feral_dog: [20, 6, 6, 100, 4, 3, 20, 10, 0],
    dog: [20, 6, 6, 100, 3, 5, 18, 8, 0],
    deathclaw: [70, 10, 10, 800, 9, 25, 80, 60, 0],
    spitting_plant: [50, 8, 8, 100, 2, 5, 100, 95, 100],
    gecko: [30, 7, 7, 150, 2, 5, 80, 75, 0],
    fire_gecko: [40, 9, 9, 300, 4, 8, 80, 80, 0],
    golden_gecko: [50, 9, 9, 400, 5, 10, 100, 100, 0],
  };
  for (const template of BUILT_IN_BESTIARY) {
    assert.deepEqual(
      [
        template.maxHp, template.sequence, template.maxAP, template.xpValue,
        template.criticalChance, template.armorClass, template.poisonResistance,
        template.radiationResistance, template.gasResistance,
      ],
      expected[template.id],
      template.name,
    );
  }
});

test('all five DT/DR pairs for every creature match the manual', () => {
  const expected: Record<string, number[]> = {
    giant_rat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    rad_rat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    lesser_molerat: [1, 5, 0, 0, 0, 0, 0, 0, 1, 5],
    greater_molerat: [4, 20, 1, 5, 0, 0, 0, 0, 4, 20],
    lesser_pigrat: [1, 5, 0, 0, 0, 0, 0, 0, 0, 5],
    greater_pigrat: [4, 25, 0, 0, 2, 10, 0, 0, 4, 25],
    giant_cockroaches: [3, 30, 0, 0, 0, 0, 0, 0, 0, 0],
    giant_ants: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    mantis: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    brahmin: [2, 10, 0, 0, 0, 0, 0, 0, 2, 10],
    floater: [10, 95, 1, 10, 5, 40, 1, 10, 10, 90],
    crawler: [10, 95, 1, 10, 5, 40, 1, 10, 10, 90],
    flailer: [10, 95, 1, 10, 5, 40, 1, 10, 10, 90],
    centaur: [10, 95, 1, 10, 5, 40, 1, 10, 10, 90],
    lesser_radscorpion: [1, 5, 0, 0, 4, 20, 0, 0, 1, 5],
    greater_radscorpion: [1, 5, 0, 0, 4, 20, 0, 0, 1, 5],
    grey_wolf: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    dire_wolf: [5, 40, 0, 0, 0, 0, 0, 0, 0, 0],
    coyote: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    feral_dog: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    dog: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    deathclaw: [4, 40, 0, 0, 4, 40, 0, 0, 4, 40],
    spitting_plant: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    gecko: [1, 10, 0, 0, 0, 0, 0, 0, 0, 0],
    fire_gecko: [3, 30, 0, 0, 3, 30, 0, 0, 2, 10],
    golden_gecko: [5, 50, 0, 0, 5, 50, 0, 0, 2, 10],
  };
  for (const template of BUILT_IN_BESTIARY) {
    const protection = template.naturalProtection;
    assert.ok(protection, `${template.name} missing natural protection row`);
    assert.deepEqual(
      [
        protection.dtNormal, protection.drNormal,
        protection.dtLaser, protection.drLaser,
        protection.dtFire, protection.drFire,
        protection.dtPlasma, protection.drPlasma,
        protection.dtExplosion, protection.drExplosion,
      ],
      expected[template.id],
      template.name,
    );
  }
});

test('representative attacks and protection preserve printed values', () => {
  const brahmin = byId('brahmin');
  assert.equal(brahmin.maxHp, 40);
  assert.deepEqual(brahmin.naturalProtection, {
    dtNormal: 2, dtLaser: 0, dtFire: 0, dtPlasma: 0, dtExplosion: 2,
    drNormal: 10, drLaser: 0, drFire: 0, drPlasma: 0, drExplosion: 10,
  });

  const deathclawClaw = weaponById(byId('deathclaw').naturalAttacks![0].weaponId);
  assert.deepEqual(
    [deathclawClaw.apSingle, deathclawClaw.damageDieCount, deathclawClaw.damageDie],
    [3, 3, 8],
  );

  const thorn = weaponById(byId('spitting_plant').naturalAttacks![0].weaponId);
  assert.deepEqual([thorn.apSingle, thorn.damageDieCount, thorn.damageDie, thorn.rangeNormal], [4, 1, 6, 8]);
  assert.equal(isRangedWeapon(thorn), true);
  assert.equal(isMeleeWeapon(thorn), false);

  const golden = byId('golden_gecko');
  assert.deepEqual(golden.naturalAttacks?.map(attack => attack.hitChance), [90, 85]);
  assert.deepEqual(
    golden.naturalAttacks?.map(attack => {
      const weapon = weaponById(attack.weaponId);
      return [weapon.apSingle, weapon.damageDieCount, weapon.damageDie];
    }),
    [[3, 1, 12], [4, 1, 20]],
  );
});

test('spawning preserves every printed catalog value and natural attack', () => {
  for (const template of BUILT_IN_BESTIARY) {
    const character = spawnBestiaryTemplate(template, BUILT_IN_WEAPONS, template.name, `spawn-${template.id}`);
    assert.equal(character.maxHp, template.maxHp, `${template.name} HP`);
    assert.equal(character.currentHp, template.maxHp, `${template.name} current HP`);
    assert.equal(character.armorClass, template.armorClass, `${template.name} stored AC`);
    assert.equal(character.maxAP, template.maxAP, `${template.name} AP`);
    assert.equal(character.currentAP, template.maxAP, `${template.name} current AP`);
    assert.equal(character.sequence, template.sequence, `${template.name} Sequence`);
    assert.deepEqual(character.manualDerivedStats, {
      armorClass: template.armorClass,
      maxAP: template.maxAP,
      sequence: template.sequence,
      criticalChance: template.criticalChance,
      baseMaxHp: template.maxHp,
    });
    assert.deepEqual(character.skills, template.skills, `${template.name} skills`);
    assert.equal(character.poisonResistance, template.poisonResistance, `${template.name} PR`);
    assert.equal(character.radiationResistance, template.radiationResistance, `${template.name} RR`);
    assert.equal(character.gasResistance, template.gasResistance, `${template.name} GR`);
    assert.equal(character.gasResistanceSecondary, template.gasResistanceSecondary, `${template.name} secondary GR`);
    assert.equal(character.xpValue, template.xpValue, `${template.name} XP`);
    assert.deepEqual(character.naturalProtection, template.naturalProtection, `${template.name} DT/DR`);
    assert.deepEqual(character.naturalAttacks, template.naturalAttacks, `${template.name} attacks`);
    assert.equal(character.equippedWeaponId, template.naturalAttacks?.[0].weaponId, `${template.name} active attack`);

    const sheet = resolveArmorAwareSheet({
      special: character.special,
      skills: character.skills,
      manualDerivedStats: character.manualDerivedStats,
      poisonResistance: character.poisonResistance,
      radiationResistance: character.radiationResistance,
      gasResistance: character.gasResistance,
      allArmor: [],
    });
    assert.equal(sheet.armorClass, template.armorClass, `${template.name} resolved AC`);
    assert.equal(sheet.maxAP, template.maxAP, `${template.name} resolved AP`);
    assert.equal(sheet.sequence, template.sequence, `${template.name} resolved Sequence`);
    assert.equal(sheet.criticalChance, template.criticalChance, `${template.name} resolved critical chance`);
    assert.deepEqual(sheet.effectiveSkills, template.skills, `${template.name} resolved skills`);
  }
});

test('restored humanoids derive AC while printed creatures retain manual AC', () => {
  const paladinTemplate = RESTORED_BESTIARY.find(template => template.id === 'brotherhood_paladin');
  assert.ok(paladinTemplate);
  const paladin = spawnBestiaryTemplate(paladinTemplate, BUILT_IN_WEAPONS, paladinTemplate.name, 'paladin');
  const paladinSheet = resolveArmorAwareSheet({
    special: paladin.special,
    skills: paladin.skills,
    manualDerivedStats: paladin.manualDerivedStats,
    usesDerivedArmorClass: paladin.usesDerivedArmorClass,
    naturalArmorClass: paladin.naturalProtection?.armorClass,
    equippedBodyArmorId: paladin.equippedBodyArmorId,
    equippedHelmetId: paladin.equippedHelmetId,
    allArmor: BUILT_IN_ARMOR,
  });
  assert.equal(paladinTemplate.armorClass, 0);
  assert.equal(paladinSheet.armorClass, 46);
  assert.deepEqual(
    [paladinSheet.armorClassBreakdown.agility, paladinSheet.armorClassBreakdown.bodyArmor, paladinSheet.armorClassBreakdown.helmet],
    [5, 28, 13],
  );

  const creatureTemplate = BUILT_IN_BESTIARY.find(template => template.id === 'brahmin');
  assert.ok(creatureTemplate);
  const creature = spawnBestiaryTemplate(creatureTemplate, BUILT_IN_WEAPONS, creatureTemplate.name, 'creature');
  const creatureSheet = resolveArmorAwareSheet({
    special: creature.special,
    skills: creature.skills,
    manualDerivedStats: creature.manualDerivedStats,
    usesDerivedArmorClass: creature.usesDerivedArmorClass,
    allArmor: BUILT_IN_ARMOR,
  });
  assert.equal(creatureSheet.armorClass, creatureTemplate.armorClass);
});

test('robot bestiary NPCs spawn as robots with complete poison resistance', () => {
  const robotTemplates = RESTORED_BESTIARY.filter(template => template.category === 'robot');
  assert.ok(robotTemplates.length > 0);
  for (const template of robotTemplates) {
    const robot = spawnBestiaryTemplate(template, BUILT_IN_WEAPONS, template.name, `robot-${template.id}`);
    assert.equal(robot.race, 'robot', `${template.name} race`);
    assert.equal(robot.poisonResistance, 100, `${template.name} poison resistance`);
    assert.equal(template.poisonResistance, 100, `${template.name} template poison resistance`);
  }
});

test('combat critical chance uses printed creature CC instead of synthetic Luck', () => {
  const brahmin = spawnBestiaryTemplate(byId('brahmin'), BUILT_IN_WEAPONS, 'Brahmin', 'crit-brahmin');
  const deathclaw = spawnBestiaryTemplate(byId('deathclaw'), BUILT_IN_WEAPONS, 'Deathclaw', 'crit-deathclaw');
  assert.equal(baseCritChance(brahmin), 2);
  assert.equal(baseCritChance(deathclaw), 9);
});

test('Deathclaw spawns with both claw and bite equipped', () => {
  const deathclaw = spawnBestiaryTemplate(byId('deathclaw'), BUILT_IN_WEAPONS, 'Deathclaw', 'dual-deathclaw');
  assert.equal(deathclaw.equippedWeaponId, 'deathclaw_claw');
  assert.equal(deathclaw.rightHandWeaponId, 'deathclaw_claw');
  assert.equal(deathclaw.leftHandWeaponId, 'deathclaw_bite');
  assert.deepEqual(deathclaw.inventoryWeaponIds, ['deathclaw_claw', 'deathclaw_bite']);
  assert.deepEqual(deathclaw.naturalAttacks?.map(attack => attack.weaponId), [
    'deathclaw_claw',
    'deathclaw_bite',
  ]);
});