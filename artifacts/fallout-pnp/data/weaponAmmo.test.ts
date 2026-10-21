import assert from 'node:assert/strict';
import test from 'node:test';
import { AMMO_TYPES, filterCompatibleAmmoIds, getAmmoReferenceEffects, getCustomAmmoReferenceUsage, getWeaponAmmoDamageProfile, resolveEquippedAmmoType, resolveEquippedAmmoTypeId, sanitizeCustomAmmoCatalog, scaleAmmoDamageComponents, validateCustomAmmo, type AmmoType } from './ammo.ts';
import { BUILT_IN_WEAPONS, formatWeaponAP, formatWeaponCapacity, weaponCategorySupportsAmmo } from './weapons.ts';

const weaponById = (id: string) => {
  const weapon = BUILT_IN_WEAPONS.find(candidate => candidate.id === id);
  assert.ok(weapon, `missing built-in weapon ${id}`);
  return weapon;
};

test('variable-damage grenade launchers, mortars, and rocket launchers leave projectile damage to ammo', () => {
  const variableDamageLauncherIds = [
    'm_78_grenade_launcher',
    'm79_grenade_rifle',
    'mk_19_personal_artillery_device',
    'm203',
    'bg_1_grenade_launcher',
    'ags_17_grenade_launcher',
    'm2_60mm_portable_mortar',
    'ps_22_51mm_mortar',
    'rocket_launcher',
  ];

  for (const weaponId of variableDamageLauncherIds) {
    const weapon = weaponById(weaponId);
    assert.deepEqual(
      [weapon.damageDieCount, weapon.damageDie, weapon.damageBonus],
      [0, 0, 0],
      `${weapon.name} has variable manual damage; projectile damage comes from its selected ammo`,
    );
  }
});

test('launcher and projectile damage profiles match manual weapon and ammunition entries', () => {
  const expected = [
    ['m_78_grenade_launcher', '40mm_frag', 0, 0, 0, 1, 12, 22],
    ['m_78_grenade_launcher', '40mm_plasma', 0, 0, 0, 5, 10, 40],
    ['m2_60mm_portable_mortar', '60mm_explosive_mortar', 0, 0, 0, 10, 10, 0],
    ['ps_22_51mm_mortar', '51mm_gas_mortar', 0, 0, 0, 7, 10, 0],
    ['law_80_rocket_launcher', 'rocket_explosive', 0, 0, 30, 6, 8, 0],
    ['law_80_rocket_launcher', 'rocket_ap', 0, 0, 30, 6, 6, 0],
    ['rocket_launcher', 'rocket_emp', 0, 0, 0, 3, 20, 0],
    ['tow_ii_missile_defense_system', 'tow_ii_rocket', 10, 10, 200, 0, 0, 0],
  ] as const;

  for (const [weaponId, ammoId, weaponDiceCount, weaponDie, weaponBonus, ammoDiceCount, ammoDie, ammoBonus] of expected) {
    const weapon = weaponById(weaponId);
    const ammo = AMMO_TYPES.find(candidate => candidate.id === ammoId);
    assert.ok(ammo, `missing built-in ammo ${ammoId}`);
    assert.deepEqual(
      getWeaponAmmoDamageProfile(weapon, ammo),
      { weaponDiceCount, weaponDie, weaponBonus, ammoDiceCount, ammoDie, ammoBonus },
      `${weapon.name} + ${ammo.name}: combine only the damage sources printed for each`,
    );
  }
});

test('double-shot profiles multiply weapon and legacy ammunition dice without changing a single shot', () => {
  const weapon = weaponById('punch_gun');
  const ammo = AMMO_TYPES.find(candidate => candidate.id === '12ga_buckshot');
  assert.ok(ammo);

  const singleShot = getWeaponAmmoDamageProfile(weapon, ammo);
  assert.deepEqual([singleShot.weaponDiceCount, singleShot.ammoDiceCount], [1, 1]);

  const doubleShot = getWeaponAmmoDamageProfile(weapon, ammo, 2);
  assert.deepEqual([doubleShot.weaponDiceCount, doubleShot.ammoDiceCount], [2, 2]);
  assert.deepEqual([doubleShot.weaponBonus, doubleShot.ammoBonus], [weapon.damageBonus, ammo.dmgBonus]);
});

test('custom ammunition components scale dice per shell without mutating their saved definitions', () => {
  const components = [{ id: 'pellet', label: 'Pellet', type: 'normal' as const, dmgDieCount: 2, dmgDie: 6, dmgBonus: 1 }];
  assert.deepEqual(scaleAmmoDamageComponents(components, 1), components);
  assert.deepEqual(scaleAmmoDamageComponents(components, 2), [
    { ...components[0], dmgDieCount: 4 },
  ]);
  assert.equal(components[0].dmgDieCount, 2);
});

test('custom ammo reference usage counts compatible weapons and saved character selections', () => {
  const usage = getCustomAmmoReferenceUsage('custom-round', [
    { compatibleAmmo: ['custom-round'] },
    { compatibleAmmo: ['built-in-round'] },
    { compatibleAmmo: ['custom-round', 'built-in-round'] },
  ], [
    { weaponAmmoStates: [{ weaponId: 'rifle', currentAmmo: 4, conditionBoxes: 0, ammoTypeId: 'custom-round' }] },
    { weaponAmmoStates: [{ weaponId: 'pistol', currentAmmo: 2, conditionBoxes: 0, ammoTypeId: 'built-in-round' }] },
  ]);

  assert.deepEqual(usage, { weaponCount: 2, savedSelectionCount: 1 });
  assert.deepEqual(getCustomAmmoReferenceUsage('unused-round', [], []), { weaponCount: 0, savedSelectionCount: 0 });
});

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

test('manual capacities are visible for every ammo-using built-in weapon', () => {
  const expectedCapacities: Record<string, number> = {
    wooden_bow: 1,
    wooden_crossbow: 1,
    composite_hunting_bow: 1,
    composite_hunting_crossbow: 1,
    '38_special_snubnose_revolver': 6,
    fn_fal: 20,
    handk_g11_e: 50,
    m2_60mm_portable_mortar: 1,
    ps_22_51mm_mortar: 1,
    law_80_rocket_launcher: 1,
    rocket_launcher: 1,
  };
  for (const [weaponId, capacity] of Object.entries(expectedCapacities)) {
    const weapon = weaponById(weaponId);
    assert.equal(weapon.magazineSize, capacity, weapon.name);
    assert.equal(formatWeaponCapacity(weapon), `Holds ${capacity} ${capacity === 1 ? 'Round' : 'Rounds'}`, weapon.name);
  }
  for (const weapon of BUILT_IN_WEAPONS.filter(candidate => (candidate.compatibleAmmo?.length ?? 0) > 0)) {
    assert.notEqual(formatWeaponCapacity(weapon), null, `${weapon.name} must show its ammo capacity`);
  }
  assert.equal(formatWeaponCapacity(weaponById('flamer')), 'Holds a variable number of rounds');
});

test('ammo-using custom weapons with no configured capacity show that it is missing', () => {
  assert.equal(formatWeaponCapacity({ magazineSize: 0, compatibleAmmo: ['custom-ammo'] }), 'Capacity not set');
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

test('custom ammunition validates and round-trips saved multi-zone area effects', () => {
  const custom: AmmoType = {
    id: 'custom-area-ammo', name: 'Zone Shell', value: 0, volume: 0, acMod: 0, drMod: 0,
    dmgDieCount: 1, dmgDie: 6, dmgBonus: 0, isCustom: true, areaRangeUnit: 'm',
    components: [{ id: 'direct', label: 'Direct', type: 'explosion', dmgDieCount: 1, dmgDie: 6, dmgBonus: 0 }],
    areaEffects: [
      { id: 'blast', label: 'Blast', kind: 'explosion', damageType: 'explosion', damageDieCount: 2, damageDie: 8, damageBonus: 4, radius: 10 },
      { id: 'rads', label: 'Radiation', kind: 'explosion', damageType: 'radiation', damageDieCount: 0, damageDie: 0, damageBonus: 25 },
    ],
  };
  assert.deepEqual(validateCustomAmmo(custom), []);
  const restored = sanitizeCustomAmmoCatalog([JSON.parse(JSON.stringify(custom)) as AmmoType]);
  assert.deepEqual(restored[0].areaEffects, custom.areaEffects);
  assert.equal(restored[0].areaRangeUnit, 'm');
  assert.deepEqual(sanitizeCustomAmmoCatalog([{ ...custom, areaEffects: [{ ...custom.areaEffects![0], radius: -1 }] }]), []);
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