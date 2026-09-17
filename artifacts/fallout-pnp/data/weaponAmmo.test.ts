import assert from 'node:assert/strict';
import test from 'node:test';
import { AMMO_TYPES } from './ammo.ts';
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
    ['super_sledge', 25, ['small_energy_cell']],
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