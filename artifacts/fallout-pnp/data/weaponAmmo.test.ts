import assert from 'node:assert/strict';
import test from 'node:test';
import { AMMO_TYPES, getAmmoReferenceEffects, resolveEquippedAmmoType, resolveEquippedAmmoTypeId } from './ammo.ts';
import { BUILT_IN_WEAPONS, weaponCategorySupportsAmmo } from './weapons.ts';

const weaponById = (id: string) => {
  const weapon = BUILT_IN_WEAPONS.find(candidate => candidate.id === id);
  assert.ok(weapon, `missing built-in weapon ${id}`);
  return weapon;
};

test('powered unarmed and melee weapons carry and consume their compatible ammunition', () => {
  const expected = [
    ['punch_gun', 1, ['12ga_buckshot', '12ga_slugs', '12ga_emp', '12ga_rubber']],
    ['power_fist', 25, ['small_energy_cell']],
    ['mega_power_fist', 25, ['small_energy_cell']],
    ['cattle_prod', 25, ['small_energy_cell']],
    ['ripper', 25, ['small_energy_cell']],
    ['super_cattle_prod', 25, ['small_energy_cell']],
    ['super_sledge', 0, undefined],
  ] as const;

  for (const [weaponId, magazineSize, compatibleAmmo] of expected) {
    const weapon = weaponById(weaponId);
    assert.equal(weapon.magazineSize, magazineSize, weapon.name);
    assert.deepEqual(weapon.compatibleAmmo, compatibleAmmo, weapon.name);
  }

  const punchGun = weaponById('punch_gun');
  assert.deepEqual([punchGun.damageDieCount, punchGun.damageDie, punchGun.damageBonus], [1, 4, 0]);
});

test('custom melee and unarmed weapons may define compatible ammo', () => {
  assert.equal(weaponCategorySupportsAmmo('unarmed'), true);
  assert.equal(weaponCategorySupportsAmmo('meleeWeapons'), true);
  assert.equal(weaponCategorySupportsAmmo('smallGuns'), true);
  assert.equal(weaponCategorySupportsAmmo('bigGuns'), true);
  assert.equal(weaponCategorySupportsAmmo('energyWeapons'), true);
  assert.equal(weaponCategorySupportsAmmo('throwing'), false);
  assert.equal(weaponCategorySupportsAmmo('natural'), false);
});

test('every built-in compatible ammo id resolves to a defined ammunition type', () => {
  const ammoIds = new Set(AMMO_TYPES.map(ammo => ammo.id));
  for (const weapon of BUILT_IN_WEAPONS) {
    for (const ammoId of weapon.compatibleAmmo ?? []) {
      assert.ok(ammoIds.has(ammoId), `${weapon.name}: missing compatible ammo ${ammoId}`);
    }
  }
});

test('the Equipment ammo reference represents every catalog entry from shared data', () => {
  const referenceEntries = AMMO_TYPES.map(ammo => ({
    id: ammo.id,
    effects: getAmmoReferenceEffects(ammo),
  }));

  assert.deepEqual(referenceEntries.map(entry => entry.id), AMMO_TYPES.map(ammo => ammo.id));
  assert.equal(referenceEntries.length, AMMO_TYPES.length);
});

test('ammo reference effects preserve damage, protection modifiers, DT bypass, and poison notes', () => {
  const armorPiercing = AMMO_TYPES.find(ammo => ammo.id === '10mm_ap');
  const poisonNeedle = AMMO_TYPES.find(ammo => ammo.id === 'hn_needler_poison');
  assert.ok(armorPiercing);
  assert.ok(poisonNeedle);

  assert.deepEqual(getAmmoReferenceEffects(armorPiercing), {
    damage: '1d4',
    acModifier: -10,
    drModifier: 0,
    ignoresDT: true,
    notes: undefined,
    poisonType: undefined,
    poisonEffect: undefined,
  });
  assert.deepEqual(getAmmoReferenceEffects(poisonNeedle), {
    damage: 'No direct damage',
    acModifier: 0,
    drModifier: 0,
    ignoresDT: false,
    notes: 'Poison Type G.',
    poisonType: 'G',
    poisonEffect: 'Type G — the worst poison. Death 5 minutes after exposure unless Antidote is administered.',
  });
});

test('a weapon with no saved ammo selection equips its first compatible ammo type', () => {
  const pistol = weaponById('10mm_pistol');
  const ammo = resolveEquippedAmmoType(pistol);
  assert.equal(resolveEquippedAmmoTypeId(pistol), '10mm_jhp');
  assert.equal(ammo?.name, '10mm JHP');
  assert.deepEqual(
    [ammo?.drMod, ammo?.dmgDieCount, ammo?.dmgDie, ammo?.dmgBonus],
    [-10, 1, 6, 0],
  );
});

test('a valid selected ammo type wins while an invalid selection returns to the default', () => {
  const pistol = weaponById('10mm_pistol');
  assert.equal(resolveEquippedAmmoTypeId(pistol, '10mm_ap'), '10mm_ap');
  assert.equal(resolveEquippedAmmoTypeId(pistol, 'not-compatible'), '10mm_jhp');
  assert.equal(resolveEquippedAmmoTypeId(weaponById('super_sledge')), undefined);
});