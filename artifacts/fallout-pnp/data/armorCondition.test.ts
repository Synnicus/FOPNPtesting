import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_SKILLS } from '../context/types.ts';
import type { Armor, Character, InitiativeEntry } from '../context/types.ts';
import { addArmorWear, adjustedArmor, armorConditionModifier, armorHits, clampArmorHits, normalizeArmorCondition, setArmorHits, wornArmor } from './armorCondition.ts';
import { resolveArmorAwareSheet } from './armorEffects.ts';
import { applyEquipmentDamage } from './equipmentDamage.ts';
import { resolveAreaTarget } from './areaEffects.ts';
import { applyProtection } from './armor.ts';

const body: Armor = {
  id: 'coat', name: 'Coat', slot: 'body', acBonus: 20, weight: 5, isCustom: true,
  dtNormal: 5, dtLaser: 5, dtFire: 5, dtPlasma: 5, dtExplosion: 5,
  drNormal: 50, drLaser: 50, drFire: 50, drPlasma: 50, drExplosion: 50,
};
const helmet: Armor = { ...body, id: 'helmet', name: 'Helmet', slot: 'helmet', acBonus: 6, dtNormal: 2, drNormal: 10 };
const character: Character = {
  id: 'target', name: 'Target', type: 'pc', race: 'human', level: 1, xp: 0,
  special: { strength: 5, perception: 5, endurance: 5, charisma: 5, intelligence: 5, agility: 5, luck: 5 },
  maxHp: 100, currentHp: 100, armorClass: 5, tempAC: 0, maxAP: 7, currentAP: 7,
  position: 'standing', sequence: 10, skills: { ...DEFAULT_SKILLS }, taggedSkills: [],
  unspentSkillPoints: 0, perks: [], radiationResistance: 0, gasResistance: 0,
  electricityResistance: 0, equippedBodyArmorId: body.id, equippedHelmetId: helmet.id,
  weaponAmmoStates: [], injuries: [], isKnockedOut: false, knockOutRoundsLeft: 0, conditions: [],
};

test('manual chart: five hits per box, all thresholds and partial boxes', () => {
  const expected = [0, 0, 0, 0, .05, .1, .2, .3, .4, .5, .6];
  for (let box = 0; box <= 10; box++) {
    assert.equal(armorConditionModifier(box * 5), expected[box]);
    if (box < 10) assert.equal(armorConditionModifier(box * 5 + 4), expected[box]);
  }
  assert.equal(armorConditionModifier(12), 0);
  assert.equal(clampArmorHits(-1), 0);
  assert.equal(clampArmorHits(100), 50);
  assert.equal(clampArmorHits(NaN), 0);
  assert.equal(clampArmorHits(20.8), 20);
});

test('each original DT/DR is scaled independently; fractions and AC/effects remain intact', () => {
  const states = [{ armorId: body.id, hitSegments: 20 }];
  const effective = adjustedArmor(body, states)!;
  assert.equal(effective.dtNormal, 4.75);
  assert.equal(effective.drNormal, 47.5);
  for (const type of ['Normal', 'Laser', 'Fire', 'Plasma', 'Explosion'] as const) {
    assert.equal(effective[`dt${type}`], 4.75);
    assert.equal(effective[`dr${type}`], 47.5);
  }
  assert.equal(effective.acBonus, body.acBonus);
  assert.equal(body.dtNormal, 5);
  assert.equal(adjustedArmor(body, [{ armorId: body.id, hitSegments: 50 }])!.drNormal, 20);
  const sheet = resolveArmorAwareSheet({ ...character, allArmor: [body, helmet], armorConditionStates: states });
  assert.equal(sheet.bodyArmor!.drNormal, 47.5);
  assert.equal(sheet.helmet!.drNormal, 10);
  assert.equal(sheet.armorClass, 31);
});

test('legacy saves default pristine; worn items survive switching, repair, and independent characters', () => {
  assert.equal(armorHits(undefined, body.id), 0);
  const states = setArmorHits(undefined, body.id, 24);
  const withHelmet = setArmorHits(states, helmet.id, 30);
  assert.equal(armorHits(withHelmet, body.id), 24);
  const repaired = setArmorHits(withHelmet, body.id, armorHits(withHelmet, body.id) - 10);
  assert.equal(armorHits(repaired, body.id), 14);
  assert.equal(armorHits(repaired, helmet.id), 30);
  assert.equal(wornArmor({ ...character, equippedBodyArmorId: undefined, armorConditionStates: states }, [body]).bodyArmor, undefined);
  assert.equal(wornArmor({ ...character, armorConditionStates: states }, [body]).bodyArmor!.drNormal, 47.5);
  assert.equal(wornArmor(character, [body]).bodyArmor!.drNormal, 50);
  assert.deepEqual(normalizeArmorCondition([{ armorId: 'coat', hitSegments: 99 }, { armorId: 'coat', hitSegments: 20 }]), [{ armorId: 'coat', hitSegments: 20 }]);
});

test('wear routes one piece per hit and excludes absorbed/zero-hit exposures', () => {
  const catalog = [body, helmet];
  assert.equal(armorHits(addArmorWear(character, catalog, 2).armorConditionStates, body.id), 2);
  const head = addArmorWear(character, catalog, 1, 'eyes');
  assert.equal(armorHits(head.armorConditionStates, helmet.id), 1);
  assert.equal(armorHits(head.armorConditionStates, body.id), 0);
  const integrated = addArmorWear(character, [{ ...body, integratedHelmet: true }, helmet], 1, 'head');
  assert.equal(armorHits(integrated.armorConditionStates, body.id), 1);
  assert.equal(armorHits(integrated.armorConditionStates, helmet.id), 0);
  assert.equal(addArmorWear(character, catalog, 0), character);
});

test('atomic HP/wear receipts are idempotent and use already-resolved starting protection', () => {
  const target = { ...character, equippedHelmetId: undefined, armorConditionStates: [{ armorId: body.id, hitSegments: 19 }] };
  const state = { characters: [target, { ...character, id: 'other' }], initiativeEntries: [{ characterId: target.id, currentHp: 100 } as InitiativeEntry] };
  const starting = wornArmor(target, [body]).bodyArmor!;
  const damage = applyProtection(25, starting.dtNormal, starting.drNormal);
  assert.equal(damage, 10);
  const applied = applyEquipmentDamage(state, [body], 'attack-1', target.id, damage, 1);
  assert.equal(applied.characters[0].currentHp, 90);
  assert.equal(applied.initiativeEntries[0].currentHp, 90);
  assert.equal(armorHits(applied.characters[0].armorConditionStates, body.id), 20);
  assert.equal(wornArmor(applied.characters[0], [body]).bodyArmor!.drNormal, 47.5);
  assert.equal(applied.characters[1], state.characters[1]);
  assert.equal(applyEquipmentDamage(applied, [body], 'attack-1', target.id, damage, 1), applied);
  const burst = applyEquipmentDamage(applied, [body], 'burst', target.id, 30, 3);
  assert.equal(armorHits(burst.characters[0].armorConditionStates, body.id), 23);
  const poisonOnly = applyEquipmentDamage(burst, [body], 'poison', target.id, 5, 0);
  assert.equal(armorHits(poisonOnly.characters[0].armorConditionStates, body.id), 23);
  const absorbed = applyEquipmentDamage(poisonOnly, [body], 'absorbed', target.id, 0, 1);
  assert.equal(armorHits(absorbed.characters[0].armorConditionStates, body.id), 23);
});

test('area and ongoing protection consume identical fractional effective armor', () => {
  const worn = wornArmor({ ...character, armorConditionStates: [{ armorId: body.id, hitSegments: 20 }] }, [body]).bodyArmor!;
  const damage = applyProtection(25, worn.dtNormal, worn.drNormal);
  const area = resolveAreaTarget({ kind: 'explosion', rawDamage: 25 }, {
    id: 'target', name: 'Target', endurance: 5, dt: worn.dtNormal, dr: worn.drNormal,
    gasInhaledResistance: 0, gasContactResistance: 0, electricityResistance: 0,
  });
  assert.equal(area.damage, damage);
  assert.equal(damage, 11);
});
