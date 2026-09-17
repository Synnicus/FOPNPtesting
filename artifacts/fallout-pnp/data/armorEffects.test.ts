import assert from 'node:assert/strict';
import test from 'node:test';
import { BUILT_IN_ARMOR } from './armor.ts';
import { aggregateArmorEffects, resolveArmorAwareSheet } from './armorEffects.ts';
import { sortInitiativeEntries, syncInitiativeEntrySheet } from './initiativeSync.ts';

const special = { strength: 5, perception: 5, endurance: 5, charisma: 5, intelligence: 5, agility: 5, luck: 5 };
const skills = {
  smallGuns: 25, bigGuns: 10, energyWeapons: 10, meleeWeapons: 20, unarmed: 20, throwing: 20,
  firstAid: 20, doctor: 10, sneak: 20, lockpick: 20, steal: 15, traps: 20,
  science: 20, repair: 15, speech: 25, barter: 20, gambling: 25, outdoorsman: 20, pilot: 20,
};
const armor = (id: string) => {
  const found = BUILT_IN_ARMOR.find(item => item.id === id);
  assert.ok(found, `missing built-in armor ${id}`);
  return found;
};

test('armor effects stack body and helmet and retain explicit source attribution', () => {
  const body = { ...armor('power_armor'), effects: { special: { strength: 3 }, skills: { sneak: -75 }, gasResistance: 100 } };
  const helmet = { ...armor('power_helmet'), effects: { skills: { sneak: -5 }, gasResistance: 100 } };
  const aggregate = aggregateArmorEffects(body, helmet);
  assert.equal(aggregate.special.strength, 3);
  assert.equal(aggregate.skills.sneak, -80);
  assert.equal(aggregate.gasResistance, 200);
  assert.deepEqual(aggregate.sources.map(source => [source.armorId, source.slot]), [
    ['power_armor', 'body'], ['power_helmet', 'helmet'],
  ]);
});

test('resolver neither mutates stored objects nor bakes armor into an unequipped sheet', () => {
  const storedSpecial = { ...special };
  const storedSkills = { ...skills };
  const power = armor('power_armor');
  const equipped = resolveArmorAwareSheet({ special: storedSpecial, skills: storedSkills, equippedBodyArmorId: power.id, allArmor: [power] });
  const unequipped = resolveArmorAwareSheet({ special: storedSpecial, skills: storedSkills, allArmor: [power] });
  assert.deepEqual(storedSpecial, special);
  assert.deepEqual(storedSkills, skills);
  assert.equal(equipped.effectiveSpecial.strength, 8);
  assert.equal(equipped.effectiveSkills.sneak, 0);
  assert.equal(unequipped.effectiveSpecial.strength, 5);
  assert.equal(unequipped.effectiveSkills.sneak, 20);
});

test('armor SPECIAL changes derived AP, AC, sequence, critical, melee, carry, and rebased skills', () => {
  const modified = {
    ...armor('clothing'),
    id: 'derived',
    effects: { special: { strength: 3, perception: 2, agility: 2, luck: 2 } },
  };
  const result = resolveArmorAwareSheet({
    special, skills, equippedBodyArmorId: 'derived', allArmor: [modified],
  });
  assert.equal(result.maxAP, 8);
  assert.equal(result.armorClass, 7);
  assert.equal(result.sequence, 14);
  assert.equal(result.criticalChance, 3);
  assert.equal(result.meleeDamage, 3);
  assert.equal(result.carryWeight, 225);
  assert.equal(result.effectiveSkills.smallGuns, 33);
});

test('resolved AC exposes body and helmet bonuses separately for cumulative summaries', () => {
  const body = armor('clothing');
  const helmet = armor('leather_cap');
  const result = resolveArmorAwareSheet({
    special,
    skills,
    equippedBodyArmorId: body.id,
    equippedHelmetId: helmet.id,
    allArmor: [body, helmet],
  });

  assert.equal(result.armorClassWithoutEquipment, 5);
  assert.equal(body.acBonus, 0);
  assert.equal(helmet.acBonus, 3);
  assert.equal(result.armorClass, result.armorClassWithoutEquipment + (body.acBonus ?? 0) + (helmet.acBonus ?? 0));
});

test('condition, chem, and armor SPECIAL layers compose without changing saved SPECIAL', () => {
  const withdrawal = resolveArmorAwareSheet({
    special,
    skills,
    conditions: ['majorWithdrawal'],
    effects: [{ isActive: true, statMods: { strength: 1 } }],
    equippedBodyArmorId: 'power_armor',
    allArmor: [armor('power_armor')],
  });
  assert.equal(withdrawal.effectiveSpecial.strength, 8);
  assert.deepEqual(special, { strength: 5, perception: 5, endurance: 5, charisma: 5, intelligence: 5, agility: 5, luck: 5 });
});

test('resistances and skills floor/cap after all armor sources', () => {
  const harsh = {
    ...armor('clothing'),
    id: 'harsh',
    effects: {
      special: { perception: -99 },
      skills: { sneak: -999 },
      gasResistance: 200, poisonResistance: -200, radiationResistance: 200, electricityResistance: -200,
    },
  };
  const result = resolveArmorAwareSheet({
    special, skills, gasResistance: -10, poisonResistance: 10, radiationResistance: -10, electricityResistance: 10,
    equippedBodyArmorId: 'harsh', allArmor: [harsh],
  });
  assert.equal(result.effectiveSpecial.perception, 1);
  assert.equal(result.effectiveSkills.sneak, 0);
  assert.equal(result.gasResistance, 100);
  assert.equal(result.poisonResistance, 0);
  assert.equal(result.radiationResistance, 100);
  assert.equal(result.electricityResistance, 0);
});

test('missing or wrong-slot equipped armor IDs are ignored safely', () => {
  const result = resolveArmorAwareSheet({
    special, skills, equippedBodyArmorId: 'not-here', equippedHelmetId: 'power_armor', allArmor: [armor('power_armor')],
  });
  assert.equal(result.bodyArmor, undefined);
  assert.equal(result.helmet, undefined);
  assert.equal(result.armorEffects.sources.length, 0);
});

test('Basic Power Armor has its exact printed numeric effects', () => {
  const power = armor('power_armor');
  const result = resolveArmorAwareSheet({
    special, skills, equippedBodyArmorId: power.id, allArmor: [power],
  });
  assert.equal(result.effectiveSpecial.strength, 8);
  assert.equal(result.gasResistance, 100);
  assert.equal(result.poisonResistance, 15);
  assert.equal(result.radiationResistance, 30);
  for (const skill of ['sneak', 'firstAid', 'doctor', 'lockpick', 'steal', 'science', 'repair'] as const) {
    assert.equal(result.armorEffects.skills[skill], skill === 'sneak' ? -75 : -10);
  }
  assert.equal(result.electricityResistance, 0);
});

test('manual pp.105–109 armor catalogue has exact numeric protection values', () => {
  type Row = [string, string, 'body' | 'helmet', number, number, number[], number[]];
  const rows: Row[] = [
    ['robe', 'Robe', 'body', 10, 5, [0,0,0,0,0], [20,25,10,10,10]],
    ['leather_jacket', 'Leather Jacket', 'body', 5, 8, [0,0,0,0,0], [20,20,10,10,20]],
    ['raider_armor', 'Raider Armor', 'body', 10, 8, [2,0,0,0,0], [25,25,15,25,20]],
    ['leather_armor', 'Leather Armor', 'body', 8, 15, [2,0,0,0,0], [25,20,20,10,20]],
    ['leather_armor_mk2', 'Leather Armor Mk II', 'body', 10, 20, [3,1,1,1,1], [25,30,17,30,25]],
    ['vandal_armor', 'Vandal Armor', 'body', 25, 15, [3,1,1,1,1], [25,30,17,30,25]],
    ['combat_leather_jacket', 'Combat Leather Jacket', 'body', 7, 20, [2,0,2,0,0], [30,20,25,10,20]],
    ['metal_armor', 'Metal Armor', 'body', 35, 10, [4,6,4,4,4], [30,75,10,20,25]],
    ['combat_armor', 'Combat Armor', 'body', 20, 20, [5,8,4,4,6], [40,60,30,50,40]],
    ['combat_armor_mk2', 'Combat Armor Mk II', 'body', 20, 25, [6,6,5,5,9], [40,65,35,50,45]],
    ['tesla_armor', 'Tesla Armor', 'body', 35, 15, [4,19,4,10,4], [20,90,10,80,20]],
    ['brotherhood_armor', 'Brotherhood Leather Armor', 'body', 10, 15, [2,0,0,0,0], [25,25,15,25,20]],
    ['brotherhood_leather_armor_mk2', 'Brotherhood Leather Armor Mk II', 'body', 11, 23, [3,1,1,1,1], [30,25,30,15,30]],
    ['reaver_banding', 'Reaver Banding', 'body', 10, 20, [4,3,1,3,3], [30,40,40,20,30]],
    ['greater_banding', 'Greater Banding', 'body', 18, 25, [5,2,4,3,5], [50,40,30,30,60]],
    ['ghoul_armor', 'Ghoul Armor', 'body', 10, 10, [0,0,0,0,0], [20,25,10,25,25]],
    ['superior_ghoul_armor', 'Superior Ghoul Armor', 'body', 10, 20, [3,1,1,1,1], [25,25,15,25,20]],
    ['brotherhood_metal_armor', 'Brotherhood Metal Armor', 'body', 35, 15, [4,3,4,3,4], [30,37,15,37,25]],
    ['metal_armor_mk2', 'Metal Armor Mk II', 'body', 35, 15, [4,7,4,4,4], [35,80,15,25,30]],
    ['brotherhood_metal_armor_mk2', 'Brotherhood Metal Armor Mk II', 'body', 35, 15, [4,4,4,4,4], [35,35,20,45,30]],
    ['mutant_plate_armor', 'Mutant Plate Armor', 'body', 40, 10, [4,3,4,3,4], [30,37,15,37,25]],
    ['spiked_mutant_plate_armor', 'Spiked Mutant Plate Armor', 'body', 50, 15, [4,4,4,4,4], [35,45,20,45,30]],
    ['brotherhood_tesla_armor', 'Brotherhood Tesla Armor', 'body', 35, 15, [4,15,7,15,4], [20,85,45,85,20]],
    ['brotherhood_combat_armor', 'Brotherhood Combat Armor', 'body', 25, 20, [8,8,7,7,8], [40,70,50,60,40]],
    ['radiation_suit', 'Radiation Suit', 'body', 20, 15, [4,0,10,0,4], [30,30,60,20,40]],
    ['brotherhood_env_armor', 'Brotherhood Environmental Armor', 'body', 30, 18, [5,5,4,5,6], [40,55,40,55,40]],
    ['brotherhood_env_armor_mk2', 'Brotherhood Environmental Armor Mk II', 'body', 35, 20, [6,6,5,6,9], [40,60,42,60,45]],
    ['pseudo_chitin_armor', 'Pseudo-Chitin Armor', 'body', 20, 30, [10,4,10,4,5], [50,20,60,20,50]],
    ['brotherhood_power_armor', 'Brotherhood Power Armor', 'body', 42, 28, [13,16,13,16,20], [50,70,60,70,60]],
    ['brotherhood_adv_power_armor', 'Brotherhood Advanced Power Armor', 'body', 50, 35, [18,17,15,17,20], [55,75,65,75,65]],
    ['power_armor', 'Power Armor', 'body', 35, 25, [12,18,12,10,20], [40,80,60,40,50]],
    ['hardened_power_armor', 'Hardened Power Armor', 'body', 50, 25, [13,19,14,13,20], [50,90,70,50,60]],
    ['adv_power_armor', 'Advanced Power Armor', 'body', 30, 30, [15,19,16,15,20], [55,90,70,60,65]],
    ['adv_power_armor_mk2', 'Advanced Power Armor Mk II', 'body', 50, 35, [18,19,16,18,20], [60,90,70,60,70]],
    ['leather_cap', 'Leather Cap', 'helmet', 0, 3, [0,0,0,0,0], [0,0,0,0,0]],
    ['metal_helmet', 'Metal Helmet', 'helmet', 0, 6, [0,0,0,0,0], [0,0,0,0,0]],
    ['combat_helmet', 'Combat Helmet', 'helmet', 0, 9, [0,0,0,0,0], [0,0,0,0,0]],
    ['environmental_helmet', 'Environmental Helmet', 'helmet', 0, 11, [0,0,0,0,0], [0,0,0,0,0]],
    ['power_helmet', 'Power Armor Helmet', 'helmet', 0, 13, [0,0,0,0,0], [0,0,0,0,0]],
  ];
  for (const [id, name, slot, weight, ac, dt, dr] of rows) {
    const item = armor(id);
    assert.deepEqual(
      [item.name, item.slot, item.weight, item.acBonus,
        item.dtNormal, item.dtLaser, item.dtFire, item.dtPlasma, item.dtExplosion,
        item.drNormal, item.drLaser, item.drFire, item.drPlasma, item.drExplosion],
      [name, slot, weight, ac, ...dt, ...dr],
      id,
    );
  }
  const effects: Record<string, object> = {
    metal_armor: { skills: { sneak: -25 } },
    combat_armor: { radiationResistance: 20 },
    combat_armor_mk2: { radiationResistance: 20 },
    tesla_armor: { skills: { sneak: -20 } },
    greater_banding: { skills: { sneak: -15 } },
    brotherhood_metal_armor: { skills: { sneak: -25 } },
    metal_armor_mk2: { skills: { sneak: -20 } },
    brotherhood_metal_armor_mk2: { skills: { sneak: -20 } },
    brotherhood_tesla_armor: { skills: { sneak: -20 } },
    brotherhood_combat_armor: { radiationResistance: 20 },
    radiation_suit: { radiationResistance: 100, gasResistance: 100, skills: { sneak: -30 } },
    brotherhood_env_armor: { gasResistance: 100, radiationResistance: 60, poisonResistance: 50, skills: { sneak: -50, doctor: -10, lockpick: -10, steal: -10, repair: -10, firstAid: -5, science: -5 } },
    brotherhood_env_armor_mk2: { special: { perception: -1 }, gasResistance: 100, radiationResistance: 90, poisonResistance: 75, skills: { sneak: -50, doctor: -11, lockpick: -11, repair: -10, steal: -10, firstAid: -7, science: -5, pilot: -2 } },
    pseudo_chitin_armor: { radiationResistance: 20 },
    brotherhood_power_armor: { special: { strength: 3, perception: -1 }, gasResistance: 100, poisonResistance: 15, radiationResistance: 30, skills: { sneak: -75, firstAid: -10, doctor: -10, lockpick: -10, steal: -10, science: -10, repair: -10 } },
    brotherhood_adv_power_armor: { special: { strength: 4, perception: -2 }, gasResistance: 100, poisonResistance: 20, radiationResistance: 60, skills: { sneak: -75, firstAid: -10, doctor: -10, lockpick: -10, steal: -10, science: -10, repair: -10 } },
    power_armor: { special: { strength: 3 }, gasResistance: 100, poisonResistance: 15, radiationResistance: 30, skills: { sneak: -75, firstAid: -10, doctor: -10, lockpick: -10, steal: -10, science: -10, repair: -10 } },
    hardened_power_armor: { special: { strength: 3 }, gasResistance: 100, poisonResistance: 15, radiationResistance: 30, skills: { sneak: -75, firstAid: -10, doctor: -10, lockpick: -10, steal: -10, science: -10, repair: -10 } },
    adv_power_armor: { special: { strength: 4 }, gasResistance: 100, poisonResistance: 20, radiationResistance: 60, skills: { sneak: -75, firstAid: -10, doctor: -10, lockpick: -10, steal: -10, science: -10, repair: -10 } },
    adv_power_armor_mk2: { special: { strength: 4 }, gasResistance: 100, poisonResistance: 40, radiationResistance: 75, skills: { sneak: -75, firstAid: -10, doctor: -10, lockpick: -10, steal: -10, science: -10, repair: -10 } },
    environmental_helmet: { gasResistance: 100 },
    power_helmet: { gasResistance: 100 },
  };
  for (const row of rows) assert.deepEqual(armor(row[0]).effects ?? {}, effects[row[0]] ?? {}, `${row[0]} effects`);
});

test('integrated, prohibited, and suit-required helmets are validated and armor optics are exposed', () => {
  const power = resolveArmorAwareSheet({
    special, skills, equippedBodyArmorId: 'adv_power_armor', equippedHelmetId: 'power_helmet', allArmor: BUILT_IN_ARMOR,
  });
  assert.equal(power.helmet, undefined, 'integrated suit rejects selected helmet');
  assert.equal(power.ignoresLightPenalties, true);
  const invalidHelmet = resolveArmorAwareSheet({
    special, skills, equippedBodyArmorId: 'leather_armor', equippedHelmetId: 'environmental_helmet', allArmor: BUILT_IN_ARMOR,
  });
  assert.equal(invalidHelmet.helmet, undefined);
  const compatibleBody = { ...armor('brotherhood_env_armor'), integratedHelmet: false };
  const validHelmet = resolveArmorAwareSheet({
    special, skills, equippedBodyArmorId: 'brotherhood_env_armor', equippedHelmetId: 'environmental_helmet',
    allArmor: [compatibleBody, armor('environmental_helmet')],
  });
  assert.equal(validHelmet.helmet?.id, 'environmental_helmet');
  const prohibited = resolveArmorAwareSheet({
    special, skills, equippedBodyArmorId: 'radiation_suit', equippedHelmetId: 'metal_helmet', allArmor: BUILT_IN_ARMOR,
  });
  assert.equal(prohibited.helmet, undefined);
});

test('live initiative preserves its die roll and reorders when armor changes Sequence', () => {
  const armoredSheet = resolveArmorAwareSheet({
    special,
    skills,
    equippedBodyArmorId: 'perception-armor',
    allArmor: [{
      ...armor('clothing'),
      id: 'perception-armor',
      effects: { special: { perception: 2 } },
    }],
  });
  const first = {
    id: 'first', characterId: 'first-character', name: 'First',
    initiative: 15, sequence: 10, currentAP: 7, maxAP: 7,
    currentHp: 20, maxHp: 20, armorClass: 5, tempAC: 0,
    isActive: true, hasActed: false, position: 'standing' as const,
  };
  const rival = {
    ...first,
    id: 'rival', characterId: 'rival-character', name: 'Rival',
    initiative: 18, sequence: 12, isActive: false,
  };
  const armored = syncInitiativeEntrySheet(first, armoredSheet);
  assert.equal(armored.initiative, 19, 'original roll 5 is added to new Sequence 14');
  assert.deepEqual(sortInitiativeEntries([armored, rival]).map(entry => entry.id), ['first', 'rival']);

  const unarmoredSheet = resolveArmorAwareSheet({ special, skills, allArmor: BUILT_IN_ARMOR });
  const unarmored = syncInitiativeEntrySheet(armored, unarmoredSheet);
  assert.equal(unarmored.initiative, 15, 'removing armor restores total without rerolling');
  assert.deepEqual(sortInitiativeEntries([unarmored, rival]).map(entry => entry.id), ['rival', 'first']);
  assert.equal(unarmored.isActive, true, 'active combatant identity survives reordering');
});