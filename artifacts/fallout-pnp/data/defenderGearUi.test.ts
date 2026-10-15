import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { BUILT_IN_ARMOR } from './armor.ts';
import { resolveArmorAwareSheet } from './armorEffects.ts';
import { resolveDefenderHandWeapon } from './combatantEquipment.ts';
import { BUILT_IN_WEAPONS } from './weapons.ts';

const combatSource = readFileSync(new URL('../app/(tabs)/index.tsx', import.meta.url).pathname, 'utf8');
const special = { strength: 5, perception: 5, endurance: 5, charisma: 5, intelligence: 5, agility: 5, luck: 5 };
const skills = {
  smallGuns: 25, bigGuns: 10, energyWeapons: 10, meleeWeapons: 20, unarmed: 20, throwing: 20,
  firstAid: 20, doctor: 10, sneak: 20, lockpick: 20, steal: 15, traps: 20,
  science: 20, repair: 15, speech: 25, barter: 20, gambling: 25, outdoorsman: 20, pilot: 20,
};

function resolveCardArmor(equippedBodyArmorId?: string, equippedHelmetId?: string) {
  return resolveArmorAwareSheet({
    special,
    skills,
    equippedBodyArmorId,
    equippedHelmetId,
    allArmor: BUILT_IN_ARMOR,
  });
}

test('defender card labels use the current hand weapon and resolved armor, including empty and invalid slots', () => {
  const equippedWeapon = resolveDefenderHandWeapon({
    rightHandWeaponId: '10mm_pistol',
    equippedWeaponId: 'assault_rifle',
    leftHandWeaponId: 'combat_knife',
  }, BUILT_IN_WEAPONS);
  assert.equal(equippedWeapon?.name, 'Colt 6520 10mm Pistol');
  const switchedWeapon = resolveDefenderHandWeapon({
    rightHandWeaponId: 'assault_rifle',
    equippedWeaponId: 'assault_rifle',
    leftHandWeaponId: 'combat_knife',
  }, BUILT_IN_WEAPONS);
  assert.equal(switchedWeapon?.name, 'AK-47 Assault Rifle');
  const removedWeapon = resolveDefenderHandWeapon({}, BUILT_IN_WEAPONS);
  assert.equal(removedWeapon, null);

  const complete = resolveCardArmor('combat_armor', 'combat_helmet');
  assert.equal(complete.bodyArmor?.name, 'Combat Armor');
  assert.equal(complete.helmet?.name, 'Combat Helmet');

  const switched = resolveCardArmor('leather_armor', 'metal_helmet');
  assert.equal(switched.bodyArmor?.name, 'Leather Armor');
  assert.equal(switched.helmet?.name, 'Metal Helmet');

  const removed = resolveCardArmor();
  assert.equal(removed.bodyArmor, undefined);
  assert.equal(removed.helmet, undefined);

  const explicitNoHelmet = resolveCardArmor('combat_armor', 'no_helmet');
  assert.equal(explicitNoHelmet.helmet?.name, 'No Helmet');

  const incompatible = resolveCardArmor('leather_armor', 'environmental_helmet');
  assert.equal(incompatible.helmet, undefined);

  assert.match(combatSource, /resolveDefenderHandWeapon\(defender, allWeapons\)/);
  assert.match(combatSource, /\{defenderWeapon\?\.name \?\? 'No Weapon'\}/);
  assert.match(combatSource, /\{bodyArmor\?\.name \?\? 'No Armor'\}/);
  assert.match(combatSource, /\{helmet\?\.name \?\? \(bodyArmor\?\.integratedHelmet \? bodyArmor\.name : 'No Helmet'\)\}/);
});
