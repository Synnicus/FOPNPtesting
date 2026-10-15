import assert from 'node:assert/strict';
import test from 'node:test';
import { AMMO_TYPES, filterCompatibleAmmoIds, getAmmoReferenceEffects, resolveEquippedAmmoType, resolveEquippedAmmoTypeId, sanitizeCustomAmmoCatalog, validateCustomAmmo, type AmmoType } from './ammo.ts';
import { BUILT_IN_WEAPONS, formatWeaponAP, formatWeaponCapacity, weaponCategorySupportsAmmo } from './weapons.ts';

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

test('equipment capacity shows one-round weapons and hides capacity on non-ammo weapons', () => {
  assert.equal(formatWeaponCapacity(weaponById('m79_grenade_rifle')), 'Holds 1 Round');
  assert.equal(formatWeaponCapacity(weaponById('power_fist')), 'Holds 25 Rounds');
  assert.equal(formatWeaponCapacity(weaponById('unarmed')), null);
  assert.equal(formatWeaponCapacity(weaponById('super_sledge')), null);
});

test('Pipe Rifle is spelled correctly and displays its one-round capacity', () => {
  const pipeRifle = weaponById('pipe_pistol');
  assert.equal(pipeRifle.name, 'Pipe Rifle');
  assert.equal(pipeRifle.magazineSize, 1);
  assert.equal(formatWeaponCapacity(pipeRifle), 'Holds 1 Round');
});

test('equipment AP costs spell out the attack modes', () => {
  assert.equal(formatWeaponAP(weaponById('unarmed')), 'Single 3 / Target 4 / Burst —');
  assert.equal(formatWeaponAP(weaponById('m79_grenade_rifle')), 'Single 5 / Target — / Burst —');
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

test('custom ammunition persists all three independently typed components and resolves from a combined catalog', () => {
  const custom: AmmoType = {
    id: 'custom-mortar', name: 'Rad Concussion Mortar', value: 0, volume: 0,
    acMod: -5, drMod: -10, ignoresDT: false,
    dmgDieCount: 2, dmgDie: 10, dmgBonus: 5, isCustom: true,
    components: [
      { id: 'blast', label: 'Blast', type: 'explosion', dmgDieCount: 2, dmgDie: 10, dmgBonus: 5 },
      { id: 'shock', label: 'Concussion', type: 'concussion', dmgDieCount: 1, dmgDie: 6, dmgBonus: 0 },
      { id: 'rads', label: 'Radiation', type: 'radiation', dmgDieCount: 0, dmgDie: 0, dmgBonus: 100 },
    ],
  };
  assert.deepEqual(validateCustomAmmo(custom), []);
  const restored = JSON.parse(JSON.stringify(custom)) as AmmoType;
  assert.deepEqual(restored.components, custom.components);
  const catalog = [...AMMO_TYPES, restored];
  const weapon = { compatibleAmmo: [custom.id] };
  assert.equal(resolveEquippedAmmoType(weapon, custom.id, catalog)?.name, custom.name);
  assert.equal(resolveEquippedAmmoTypeId(weapon, custom.id, catalog), custom.id);
});

test('custom ammunition validation rejects empty, excessive, duplicate, and invalid components', () => {
  const base: AmmoType = {
    id: 'custom', name: 'Custom', value: 0, volume: 0, acMod: 0, drMod: 0,
    dmgDieCount: 1, dmgDie: 6, dmgBonus: 0, isCustom: true, components: [],
  };
  assert.match(validateCustomAmmo(base).join(' '), /one to three/i);
  const component = { id: 'same', label: 'Damage', type: 'normal' as const, dmgDieCount: 1, dmgDie: 6, dmgBonus: 0 };
  assert.match(validateCustomAmmo({ ...base, components: [component, component, component, component] }).join(' '), /one to three|unique/i);
  assert.match(validateCustomAmmo({ ...base, components: [{ ...component, dmgDie: 0 }] }).join(' '), /both be zero|positive/i);
  assert.match(validateCustomAmmo({ ...base, id: AMMO_TYPES[0].id, components: [component] }).join(' '), /unique/i);
});

test('malformed imported ammunition is skipped without throwing and stale weapon references are removed', () => {
  assert.doesNotThrow(() => sanitizeCustomAmmoCatalog([
    { id: null, name: {}, components: [{ id: null, label: null, type: 'void', dmgDieCount: 'many' }] },
    { id: 'bad-notes', name: 'Bad', value: 0, volume: 0, acMod: 0, drMod: 0, ignoresDT: 'yes', notes: {}, dmgDieCount: 0, dmgDie: 0, dmgBonus: 1, components: [{ id: 'x', label: 'x', type: 'normal', dmgDieCount: 0, dmgDie: 0, dmgBonus: 1 }] },
    { id: 'bad-poison', name: 'Bad poison', value: 0, volume: 0, acMod: 0, drMod: 0, dmgDieCount: 0, dmgDie: 0, dmgBonus: 1, poison: { type: 7, effectText: null }, components: [{ id: 'x', label: 'x', type: 'normal', dmgDieCount: 0, dmgDie: 0, dmgBonus: 1 }] },
  ]));
  const custom = {
    id: 'safe-custom', name: 'Safe Custom', value: 0, volume: 0, acMod: 0, drMod: 0,
    dmgDieCount: 1, dmgDie: 6, dmgBonus: 0, isCustom: true,
    components: [{ id: 'main', label: 'Main', type: 'normal', dmgDieCount: 1, dmgDie: 6, dmgBonus: 0 }],
  } satisfies AmmoType;
  const sanitized = sanitizeCustomAmmoCatalog([custom, { ...custom, id: 'duplicate-built-in', components: [{ ...custom.components[0], type: 'void' }] }]);
  assert.deepEqual(sanitized.map(ammo => ammo.id), ['safe-custom']);
  assert.deepEqual(filterCompatibleAmmoIds(['safe-custom', 'missing'], [...AMMO_TYPES, ...sanitized]), ['safe-custom']);
});

test('area-profile mine and trap weapons may declare compatible ammunition', () => {
  assert.equal(weaponCategorySupportsAmmo('minesTraps'), true);
});