import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SKILLS } from '../context/types.ts';
import type {
  Armor,
  Character,
  CustomPerkDefinition,
  CustomWeaponMod,
  Weapon,
} from '../context/types.ts';
import {
  BUILT_IN_RULE_TAGS,
  computeCustomPerkEffects,
  computeCustomWeaponModEffects,
  customRuleConditionMatches,
  customPerkAsPerk,
  getSelectableArmorTags,
  getSelectablePerkStatuses,
  getSelectableWeaponTags,
  inferArmorTags,
  inferWeaponTags,
  reverseCustomPerkOneTimeGrants,
  syncCustomPerkOneTimeGrants,
  validateCustomPerk,
  validateCustomWeaponMod,
} from './customRules.ts';
import {
  evaluateRaceTagPerkEligibility,
  getCustomRaceProfileTagId,
} from './races.ts';
import { BUILT_IN_WEAPONS } from './weapons.ts';
import { BUILT_IN_VEHICLE_WEAPONS } from './vehicleWeapons.ts';
import { BUILT_IN_ARMOR } from './armor.ts';

const weapon = {
  id: 'rifle',
  name: 'Assault Rifle',
  category: 'smallGuns',
  skill: 'smallGuns',
  damageType: 'normal',
  damageDieCount: 1,
  damageDie: 6,
  damageBonus: 0,
  burstLimit: 5,
  mods: [],
  isCustom: false,
} as unknown as Weapon;

const armor = {
  id: 'armor',
  name: 'T-51 Power Armor',
  slot: 'body',
  isCustom: false,
} as unknown as Armor;

const character = {
  id: 'pc',
  name: 'Test Character',
  race: 'human',
  traits: ['night_person'],
  conditions: ['poisoned'],
  perks: [{ perkId: 'custom-perk', rank: 2 }],
} as unknown as Character;

test('weapon and armor tags infer common built-in classifications and preserve campaign tags', () => {
  assert.deepEqual(inferWeaponTags(weapon), ['small-guns', 'burst-capable', 'rifle', 'assault-rifle']);
  assert.ok(inferArmorTags(armor).includes('power-armor'));
  assert.ok(inferArmorTags({ ...armor, tags: ['vault-tech'] }).includes('vault-tech'));
});

test('weapon-tag selection includes built-in, campaign, and previously selected custom tags without armor-only tags', () => {
  const options = getSelectableWeaponTags([
    { id: 'weapon-custom', label: 'Campaign Rifle', appliesTo: 'weapon' },
    { id: 'both-custom', label: 'Campaign Shared', appliesTo: 'both' },
    { id: 'armor-only', label: 'Armor Only', appliesTo: 'armor' },
    { id: 'small-guns', label: 'Duplicate Small Guns', appliesTo: 'weapon' },
  ], ['orphaned-legacy-tag', 'armor-only']);

  const byId = new Map(options.map(tag => [tag.id, tag]));
  assert.equal(byId.get('small-guns')?.label, 'Small Guns');
  assert.equal(byId.get('weapon-custom')?.label, 'Campaign Rifle');
  assert.equal(byId.get('both-custom')?.label, 'Campaign Shared');
  assert.equal(byId.get('armor-only')?.label, 'armor-only');
  assert.equal(byId.get('orphaned-legacy-tag')?.label, 'orphaned-legacy-tag');
  assert.equal(options.some(tag => tag.id === 'armor-only' && tag.label === 'Armor Only'), false);
});

test('armor-tag selection includes built-in and campaign armor tags while preserving selected legacy tags', () => {
  const options = getSelectableArmorTags([
    { id: 'armor-custom', label: 'Campaign Armor', appliesTo: 'armor' },
    { id: 'shared-custom', label: 'Campaign Shared', appliesTo: 'both' },
    { id: 'weapon-only', label: 'Weapon Only', appliesTo: 'weapon' },
  ], ['orphaned-armor-tag']);

  const byId = new Map(options.map(tag => [tag.id, tag]));
  assert.equal(byId.get('power-armor')?.label, 'Power Armor');
  assert.equal(byId.get('armor-custom')?.label, 'Campaign Armor');
  assert.equal(byId.get('shared-custom')?.label, 'Campaign Shared');
  assert.equal(byId.has('weapon-only'), false);
  assert.equal(byId.get('orphaned-armor-tag')?.label, 'orphaned-armor-tag');
});

test('every built-in weapon and vehicle weapon has explicit, registered family tags', () => {
  const familyTagByCategory: Record<Weapon['category'], string> = {
    unarmed: 'unarmed',
    natural: 'natural-attack',
    meleeWeapons: 'melee-weapons',
    smallGuns: 'small-guns',
    bigGuns: 'big-guns',
    energyWeapons: 'energy-weapons',
    throwing: 'throwing',
    minesTraps: 'mines-traps',
  };
  const registeredTags = new Set(BUILT_IN_RULE_TAGS.filter(tag => tag.appliesTo === 'weapon').map(tag => tag.id));
  const allBuiltInWeapons = [...BUILT_IN_WEAPONS, ...BUILT_IN_VEHICLE_WEAPONS];

  assert.ok(allBuiltInWeapons.length > BUILT_IN_WEAPONS.length);
  for (const builtIn of allBuiltInWeapons) {
    assert.ok(builtIn.tags?.includes(familyTagByCategory[builtIn.category]), `${builtIn.name} has its category tag`);
    assert.ok(builtIn.tags && builtIn.tags.length > 0, `${builtIn.name} has persisted tags`);
    for (const tag of builtIn.tags ?? []) {
      assert.ok(tag === 'traps' || registeredTags.has(tag), `${builtIn.name} uses registered tag ${tag}`);
    }
  }
  for (const natural of BUILT_IN_WEAPONS.filter(item => item.category === 'natural')) {
    assert.ok(natural.tags?.includes('natural-attack'), `${natural.name} has natural-attack`);
    assert.ok(natural.tags?.includes('unarmed'), `${natural.name} also matches unarmed`);
  }
  for (const bigGun of [...BUILT_IN_WEAPONS, ...BUILT_IN_VEHICLE_WEAPONS].filter(item => item.category === 'bigGuns')) {
    assert.ok(bigGun.tags?.includes('heavy-weapon'), `${bigGun.name} has heavy-weapon`);
  }
});

test('weapon subtype tags distinguish shotguns, launchers, thrown grenades, mines, and traps', () => {
  const findWeapon = (id: string) => {
    const found = BUILT_IN_WEAPONS.find(item => item.id === id);
    assert.ok(found, `expected built-in weapon ${id}`);
    return found;
  };
  const shotgun = findWeapon('shotgun');
  assert.ok(shotgun.tags?.includes('small-guns'));
  assert.ok(shotgun.tags?.includes('shotgun'));

  const grenadeLauncher = findWeapon('m79_grenade_rifle');
  assert.ok(grenadeLauncher.tags?.includes('launcher'));
  assert.ok(grenadeLauncher.tags?.includes('grenade-launcher'));
  assert.ok(grenadeLauncher.tags?.includes('explosive'));
  assert.ok(!grenadeLauncher.tags?.includes('grenade'));

  const missileSystem = findWeapon('tow_ii_missile_defense_system');
  assert.ok(missileSystem.tags?.includes('launcher'));
  assert.ok(missileSystem.tags?.includes('missile-rocket-launcher'));

  const handGrenade = findWeapon('frag_grenade');
  assert.ok(handGrenade.tags?.includes('grenade'));
  assert.ok(handGrenade.tags?.includes('explosive'));
  assert.ok(!handGrenade.tags?.includes('launcher'));
  assert.ok(!handGrenade.tags?.includes('grenade-launcher'));

  assert.ok(findWeapon('t13_antipersonnel_mine').tags?.includes('mine'));
  assert.ok(findWeapon('t13_antipersonnel_mine').tags?.includes('mines-traps'));
  assert.ok(findWeapon('explosive_trap').tags?.includes('trap'));
  assert.ok(findWeapon('explosive_trap').tags?.includes('explosive'));
  assert.ok(findWeapon('m2_60mm_portable_mortar').tags?.includes('mortar'));
  assert.ok(findWeapon('m2_60mm_portable_mortar').tags?.includes('launcher'));
  assert.ok(BUILT_IN_VEHICLE_WEAPONS.find(item => item.id === 'rheinmetall_120mm_gun')?.tags?.includes('cannon'));
  assert.ok(BUILT_IN_VEHICLE_WEAPONS.find(item => item.id === 'vehicle_152mm_shillelagh')?.tags?.includes('missile-rocket-launcher'));
});

test('firearm subtype tags use named actions and known model roles rather than burst absence', () => {
  const m1Garand = BUILT_IN_WEAPONS.find(item => item.id === 'm1_garand_rifle');
  const ak74 = BUILT_IN_WEAPONS.find(item => item.id === 'ak_74');
  const svd = BUILT_IN_WEAPONS.find(item => item.id === 'svd_4000');
  const m14 = BUILT_IN_WEAPONS.find(item => item.id === 'm14');
  assert.ok(m1Garand?.tags?.includes('rifle'));
  assert.ok(!m1Garand?.tags?.includes('single-shot-rifle'));
  assert.ok(ak74?.tags?.includes('assault-rifle'));
  assert.ok(svd?.tags?.includes('sniper-rifle'));
  assert.ok(m14?.tags?.includes('battle-rifle'));

  const explicitlySingleShot = inferWeaponTags({
    ...weapon,
    id: 'manual_single_shot_rifle',
    name: 'Single-shot Rifle',
    burstLimit: 1,
  });
  assert.ok(explicitlySingleShot.includes('single-shot-rifle'));
});

test('built-in catalog tags satisfy the same conditions custom perks evaluate', () => {
  const shotgun = BUILT_IN_WEAPONS.find(item => item.id === 'shotgun');
  const combatArmor = BUILT_IN_ARMOR.find(item => /combat armor/i.test(item.name));
  assert.ok(shotgun);
  assert.ok(combatArmor);
  assert.equal(customRuleConditionMatches(character, shotgun, [combatArmor], null, {
    weaponTags: ['small-guns', 'shotgun'],
    armorTags: ['combat-armor'],
  }), true);

  const vehicleCannon = BUILT_IN_VEHICLE_WEAPONS.find(item => item.id === 'rheinmetall_120mm_gun');
  assert.ok(vehicleCannon);
  assert.equal(customRuleConditionMatches(character, vehicleCannon, [], null, {
    weaponTags: ['cannon'],
  }), true);
});

test('every built-in armor entry has explicit category and name-backed material tags', () => {
  const registeredTags = new Set(BUILT_IN_RULE_TAGS.filter(tag => tag.appliesTo === 'armor').map(tag => tag.id));
  for (const item of BUILT_IN_ARMOR) {
    assert.ok(item.tags?.includes('armor'), `${item.name} has armor`);
    assert.ok(item.tags?.includes(item.slot === 'helmet' ? 'helmet' : item.id === 'clothing' ? 'clothing' : 'body-armor'), `${item.name} has its slot/type tag`);
    for (const tag of item.tags ?? []) {
      assert.ok(registeredTags.has(tag), `${item.name} uses registered armor tag ${tag}`);
    }
  }
  for (const item of BUILT_IN_ARMOR.filter(armor => /leather/i.test(armor.name))) {
    assert.ok(item.tags?.includes('leather-armor'), `${item.name} has leather-armor`);
  }
  for (const item of BUILT_IN_ARMOR.filter(armor => /metal/i.test(armor.name))) {
    assert.ok(item.tags?.includes('metal-armor'), `${item.name} has metal-armor`);
  }
  assert.ok(BUILT_IN_ARMOR.find(item => item.id === 'pseudo_chitin_armor')?.tags?.includes('chitin-armor'));
  assert.ok(BUILT_IN_ARMOR.find(item => item.id === 'environmental_helmet')?.tags?.includes('environmental-armor'));
  assert.ok(!BUILT_IN_ARMOR.find(item => item.id === 'raider_armor')?.tags?.includes('metal-armor'));
  assert.ok(!BUILT_IN_ARMOR.find(item => item.id === 'reaver_banding')?.tags?.includes('metal-armor'));
  assert.ok(!BUILT_IN_ARMOR.find(item => item.id === 'clothing')?.tags?.includes('body-armor'));
});

test('custom mod applies its direct typed damage, meter-only radiation, and weapon modifiers', () => {
  const mod: CustomWeaponMod = {
    id: 'mod',
    name: 'Muzzle Device',
    description: 'A tactical flash signature.',
    programmatic: true,
    appliesToTags: ['assault-rifle'],
    effects: [
      { id: 'hit', kind: 'toHit', value: 4 },
      { id: 'range', kind: 'range', value: 2 },
      { id: 'fire', kind: 'damage', value: 1, damageType: 'fire', diceCount: 1, dieSides: 6 },
      { id: 'rad', kind: 'radiationExposure', value: 2 },
      { id: 'ap', kind: 'attackApDiscount', value: 1 },
      { id: 'dt', kind: 'ignoreDT', value: 2 },
    ],
  };
  const effects = computeCustomWeaponModEffects(['mod'], [mod], weapon);
  assert.equal(effects.toHit, 4);
  assert.equal(effects.range, 2);
  assert.equal(effects.apDiscount, 1);
  assert.equal(effects.ignoreDT, 2);
  assert.deepEqual(effects.damageComponents.map(component => component.type), ['fire', 'radiation']);
  assert.equal(effects.damageComponents[0].dmgDieCount, 1);
  assert.equal(effects.damageComponents[1].dmgBonus, 2);
  assert.deepEqual(computeCustomWeaponModEffects(['mod'], [mod], {
    ...weapon,
    name: 'Combat Knife',
    category: 'meleeWeapons',
    skill: 'meleeWeapons',
  }).damageComponents, []);
});

test('description-only custom mods remain non-mechanical', () => {
  const mod: CustomWeaponMod = {
    id: 'flash',
    name: 'Muzzle Flash',
    description: 'May reveal the shooter in a dark room.',
    programmatic: false,
    effects: [{ id: 'range', kind: 'range', value: 100 }],
  };
  assert.equal(validateCustomWeaponMod(mod), true);
  assert.equal(computeCustomWeaponModEffects(['flash'], [mod], weapon).range, 0);
});

test('custom perk conditions require every populated group and allow any listed value in each group', () => {
  const condition = {
    weaponTags: ['pistol', 'assault-rifle'],
    armorTags: ['power-armor'],
    attackModes: ['burst'] as ['burst'],
    statuses: ['poisoned', 'hidden'],
  };
  assert.equal(customRuleConditionMatches(character, weapon, [armor], 'burst', condition), true);
  assert.equal(customRuleConditionMatches({ ...character, conditions: ['hidden'] }, weapon, [armor], 'burst', condition), true);
  assert.equal(customRuleConditionMatches(character, weapon, [], 'burst', condition), false);
  assert.equal(customRuleConditionMatches(character, weapon, [armor], 'single', condition), false);
  assert.equal(customRuleConditionMatches(character, weapon, [armor], null, condition), false);
  assert.equal(customRuleConditionMatches({ ...character, conditions: [] }, weapon, [armor], 'burst', condition), false);
  assert.equal(customRuleConditionMatches(character, null, [armor], 'burst', condition), false);
});

test('perk status choices include supported conditions and preserve legacy saved status strings', () => {
  const statuses = getSelectablePerkStatuses(['poisoned', 'hidden']);
  assert.deepEqual(statuses.slice(0, 4), [
    { id: 'minorWithdrawal', label: 'Minor Withdrawal' },
    { id: 'majorWithdrawal', label: 'Major Withdrawal' },
    { id: 'addictionRecovery', label: 'Addiction Recovery' },
    { id: 'drunk', label: 'Drunk' },
  ]);
  assert.deepEqual(statuses.slice(-2), [
    { id: 'poisoned', label: 'poisoned' },
    { id: 'hidden', label: 'hidden' },
  ]);
});

test('custom perk race conditions match exact races, including distinct Half-Mutant and Super Mutant values', () => {
  assert.equal(customRuleConditionMatches(character, null, [], 'single', {
    attackerRaces: ['human', 'halfMutant'],
  }), true);
  assert.equal(customRuleConditionMatches(character, null, [], 'single', {
    attackerRaces: ['superMutant'],
  }), false);
  assert.equal(customRuleConditionMatches({ ...character, race: 'halfMutant' }, null, [], 'single', {
    attackerRaces: ['superMutant'],
  }), false);
  assert.equal(customRuleConditionMatches({ ...character, race: 'halfMutant' }, null, [], 'single', {
    attackerRaces: ['superMutant', 'halfMutant'],
  }), true);
});

test('custom race tags gate custom perk eligibility and effect conditions', () => {
  const profileTag = getCustomRaceProfileTagId('synth');
  const perk: CustomPerkDefinition = {
    id: 'synth-specialist',
    name: 'Synth Specialist',
    description: 'A synthetic-only perk.',
    category: 'combat',
    minLevel: 1,
    maxRanks: 2,
    requiresRaceTags: [profileTag],
    excludedRaceTags: ['race-robot'],
    programmatic: true,
    conditions: { attackerRaceTags: ['race-cybernetic'] },
    effects: [{ id: 'synth-to-hit', kind: 'toHit', value: 2 }],
  };
  const synth = {
    ...character,
    race: 'customRace',
    customRaceId: 'synth',
    raceTags: ['race-cybernetic'],
    level: 1,
    special: { strength: 5, perception: 5, endurance: 5, charisma: 5, intelligence: 5, agility: 5, luck: 5 },
    skills: { ...DEFAULT_SKILLS },
    taggedSkills: [],
    breakTheRulesPending: false,
    perks: [],
  } as unknown as Character;

  assert.equal(validateCustomPerk(perk), true);
  const mappedPerk = customPerkAsPerk(perk);
  assert.deepEqual(mappedPerk.requiresRaceTags, [profileTag]);
  assert.deepEqual(mappedPerk.excludedRaceTags, ['race-robot']);
  assert.deepEqual(evaluateRaceTagPerkEligibility(synth, mappedPerk.requiresRaceTags, mappedPerk.excludedRaceTags), {
    missingRequiredTag: false,
    excludedTagMatched: false,
  });
  assert.equal(customRuleConditionMatches(synth, null, [], 'single', perk.conditions), true);
  assert.equal(computeCustomPerkEffects({
    ...synth,
    perks: [{ perkId: perk.id, rank: 1 }],
  }, [perk]).toHit, 2);

  const noProfileMatch = { ...synth, customRaceId: 'other', raceTags: [] };
  assert.deepEqual(evaluateRaceTagPerkEligibility(noProfileMatch, mappedPerk.requiresRaceTags, mappedPerk.excludedRaceTags), {
    missingRequiredTag: true,
    excludedTagMatched: false,
  });
  assert.equal(customRuleConditionMatches(noProfileMatch, null, [], 'single', perk.conditions), false);
  assert.equal(computeCustomPerkEffects({
    ...noProfileMatch,
    perks: [{ perkId: perk.id, rank: 1 }],
  }, [perk]).toHit, 0);
});

test('custom perk trait conditions accept any selected trait and require all populated groups', () => {
  assert.equal(customRuleConditionMatches(character, null, [], 'single', {
    attackerTraits: ['fast_shot', 'night_person'],
  }), true);
  assert.equal(customRuleConditionMatches(character, null, [], 'single', {
    attackerTraits: ['fast_shot'],
  }), false);
  assert.equal(customRuleConditionMatches(character, null, [], 'single', {
    attackerRaces: ['human'],
    attackerTraits: ['fast_shot'],
  }), false);
  assert.equal(customRuleConditionMatches(character, null, [], 'single', {
    attackerRaces: ['human', 'halfMutant'],
    attackerTraits: ['night_person', 'fast_shot'],
  }), true);
});

test('race and trait requirements use the same evaluator for sheet and combat custom perk effects', () => {
  const perk: CustomPerkDefinition = {
    id: 'race-trait-perk',
    name: 'Mutant Marksman',
    description: 'A race- and trait-specific bonus.',
    category: 'combat',
    minLevel: 1,
    maxRanks: 2,
    programmatic: true,
    conditions: { attackerRaces: ['halfMutant'], attackerTraits: ['night_person'] },
    effects: [{ id: 'to-hit', kind: 'toHit', value: 2 }],
  };
  assert.equal(validateCustomPerk(perk), true);
  const halfMutant = {
    ...character,
    race: 'halfMutant',
    perks: [{ perkId: perk.id, rank: 1 }],
  } as unknown as Character;
  assert.equal(computeCustomPerkEffects(halfMutant, [perk]).toHit, 2);
  assert.equal(computeCustomPerkEffects(halfMutant, [perk], { weapon, armor: [armor], mode: 'burst' }).toHit, 2);
  assert.equal(computeCustomPerkEffects({ ...halfMutant, race: 'superMutant' }, [perk]).toHit, 0);
  assert.equal(computeCustomPerkEffects({ ...halfMutant, traits: [] }, [perk], { weapon, armor: [armor], mode: 'single' }).toHit, 0);
});

test('custom perk effects honor conditions and ranks, with typed damage kept separate from radiation exposure', () => {
  const perk: CustomPerkDefinition = {
    id: 'custom-perk',
    name: 'Automatic Rifle Specialist',
    description: 'Extra combat effects for a qualified attack.',
    category: 'combat',
    minLevel: 1,
    maxRanks: 3,
    programmatic: true,
    conditions: { weaponTags: ['assault-rifle'], armorTags: ['power-armor'], attackModes: ['burst'], statuses: ['poisoned'] },
    effects: [
      { id: 'to-hit', kind: 'toHit', value: 2 },
      { id: 'skill', kind: 'skillBonus', skill: 'smallGuns', value: 3 },
      { id: 'fire', kind: 'damage', damageType: 'fire', value: 1, diceCount: 1, dieSides: 6 },
      { id: 'rad', kind: 'radiationExposure', value: 2 },
      { id: 'dt', kind: 'ignoreDT', value: 1 },
    ],
  };
  assert.equal(validateCustomPerk(perk), true);
  const effects = computeCustomPerkEffects(character, [perk], { weapon, armor: [armor], mode: 'burst' });
  assert.equal(effects.toHit, 4);
  assert.equal(effects.skillBonuses.smallGuns, 6);
  assert.equal(effects.ignoreDT, 2);
  assert.deepEqual(effects.damageComponents.map(component => component.type), ['fire', 'radiation']);
  const inactive = computeCustomPerkEffects(character, [perk], { weapon, armor: [armor], mode: 'single' });
  assert.equal(inactive.toHit, 0);
  assert.deepEqual(inactive.damageComponents, []);
});

test('custom perk one-time skill and SPECIAL grants are recorded per rank and removed without touching later changes', () => {
  const perk: CustomPerkDefinition = {
    id: 'permanent-perk',
    name: 'Trained Specialist',
    description: 'Permanent training.',
    category: 'utility',
    minLevel: 1,
    maxRanks: 3,
    programmatic: true,
    effects: [
      { id: 'skill-grant', kind: 'skillBonus', skill: 'smallGuns', value: 4, application: 'oneTime' },
      { id: 'special-grant', kind: 'specialBonus', special: 'strength', value: 1, perRank: false, application: 'oneTime' },
      { id: 'ongoing-skill', kind: 'skillBonus', skill: 'repair', value: 2 },
      { id: 'ongoing-special', kind: 'specialBonus', special: 'luck', value: 1 },
    ],
  };
  const original = {
    ...character,
    special: { strength: 5, perception: 5, endurance: 5, charisma: 5, intelligence: 5, agility: 5, luck: 5 },
    skills: {
      smallGuns: 25, bigGuns: 10, energyWeapons: 10, meleeWeapons: 20, unarmed: 20, throwing: 20,
      firstAid: 20, doctor: 10, sneak: 20, lockpick: 20, steal: 15, traps: 20,
      science: 20, repair: 15, speech: 25, barter: 20, gambling: 25, outdoorsman: 20, pilot: 20,
    },
    perks: [{ perkId: perk.id, rank: 1 }],
  } as unknown as Character;

  assert.equal(validateCustomPerk(perk), true);
  const rankOne = syncCustomPerkOneTimeGrants(original, perk, 0, 1);
  assert.equal(rankOne.skills.smallGuns, original.skills.smallGuns); // Grants do not become purchased skill offsets.
  assert.equal(rankOne.special.strength, 6);
  assert.equal(rankOne.skills.meleeWeapons, 22); // Preserve skill offsets when SPECIAL changes.
  assert.equal(rankOne.perks[0].appliedCustomPerkGrants?.length, 2);

  // A repeated application for the same rank is idempotent.
  const duplicate = syncCustomPerkOneTimeGrants(rankOne, perk, 0, 1);
  assert.equal(duplicate.skills.smallGuns, original.skills.smallGuns);
  assert.equal(duplicate.special.strength, 6);

  const rankTwo = syncCustomPerkOneTimeGrants(
    { ...rankOne, perks: [{ ...rankOne.perks[0], rank: 2 }] },
    perk,
    1,
    2,
  );
  assert.equal(rankTwo.skills.smallGuns, original.skills.smallGuns);
  assert.equal(computeCustomPerkEffects(rankTwo, [perk]).skillBonuses.smallGuns, 8);
  assert.equal(rankTwo.special.strength, 6); // Fixed grants are not repeated for later ranks.
  assert.equal(rankTwo.perks[0].appliedCustomPerkGrants?.length, 3);

  const rankOneAgain = syncCustomPerkOneTimeGrants(rankTwo, perk, 2, 1);
  assert.equal(rankOneAgain.skills.smallGuns, original.skills.smallGuns);
  assert.equal(rankOneAgain.special.strength, 6);
  assert.equal(rankOneAgain.perks[0].appliedCustomPerkGrants?.length, 2);

  const characterWithLaterChanges = {
    ...rankOneAgain,
    skills: {
      ...rankOneAgain.skills,
      smallGuns: rankOneAgain.skills.smallGuns + 7,
      meleeWeapons: rankOneAgain.skills.meleeWeapons + 4,
    },
    special: { ...rankOneAgain.special, strength: rankOneAgain.special.strength + 2 },
  };
  const restored = reverseCustomPerkOneTimeGrants(
    JSON.parse(JSON.stringify(characterWithLaterChanges)) as Character,
    perk.id,
  );
  assert.equal(restored.skills.smallGuns, original.skills.smallGuns + 7);
  assert.equal(restored.special.strength, original.special.strength + 2);
  assert.equal(restored.skills.meleeWeapons, original.skills.meleeWeapons + 4);
  assert.equal(computeCustomPerkEffects(restored, [perk]).skillBonuses.smallGuns, undefined);
  assert.deepEqual(reverseCustomPerkOneTimeGrants(restored, perk.id), restored);

  const ongoing = computeCustomPerkEffects(rankOneAgain, [perk]);
  assert.equal(ongoing.skillBonuses.smallGuns, 4); // One-time rank-1 grant; the ongoing modifier has another target.
  assert.equal(ongoing.skillBonuses.repair, 2);
  assert.equal(ongoing.specialBonuses.strength, undefined);
  assert.equal(ongoing.specialBonuses.luck, 1);
});

test('custom perk one-time classification rejects unsupported effect kinds and malformed targets', () => {
  const base: CustomPerkDefinition = {
    id: 'invalid-one-time',
    name: 'Invalid One-Time',
    description: '',
    category: 'utility',
    minLevel: 1,
    maxRanks: 1,
    programmatic: true,
    effects: [{ id: 'bad', kind: 'toHit', value: 2, application: 'oneTime' }],
  };
  assert.equal(validateCustomPerk(base), false);
  assert.equal(validateCustomPerk({
    ...base,
    effects: [{ id: 'bad-target', kind: 'skillBonus', value: 2, skill: 'not-a-skill', application: 'oneTime' }],
  }), false);
  assert.equal(validateCustomPerk({
    ...base,
    effects: [{ id: 'valid', kind: 'specialBonus', value: 1, special: 'luck', application: 'oneTime' }],
  }), true);
});
