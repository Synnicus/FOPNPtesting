import test from 'node:test';
import assert from 'node:assert/strict';
import type {
  Armor,
  Character,
  CustomPerkDefinition,
  CustomWeaponMod,
  Weapon,
} from '../context/types.ts';
import {
  computeCustomPerkEffects,
  computeCustomWeaponModEffects,
  customRuleConditionMatches,
  inferArmorTags,
  inferWeaponTags,
  validateCustomPerk,
  validateCustomWeaponMod,
} from './customRules.ts';

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
  traits: ['night_owl'],
  conditions: ['poisoned'],
  perks: [{ perkId: 'custom-perk', rank: 2 }],
} as unknown as Character;

test('weapon and armor tags infer common built-in classifications and preserve campaign tags', () => {
  assert.deepEqual(inferWeaponTags(weapon), ['small-guns', 'burst-capable', 'rifle', 'assault-rifle']);
  assert.ok(inferArmorTags(armor).includes('power-armor'));
  assert.ok(inferArmorTags({ ...armor, tags: ['vault-tech'] }).includes('vault-tech'));
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
  assert.equal(customRuleConditionMatches(character, weapon, [], 'burst', condition), false);
  assert.equal(customRuleConditionMatches(character, weapon, [armor], 'single', condition), false);
  assert.equal(customRuleConditionMatches(character, weapon, [armor], null, condition), false);
  assert.equal(customRuleConditionMatches({ ...character, conditions: [] }, weapon, [armor], 'burst', condition), false);
  assert.equal(customRuleConditionMatches(character, null, [armor], 'burst', condition), false);
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
