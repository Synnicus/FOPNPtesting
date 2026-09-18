import assert from 'node:assert/strict';
import test from 'node:test';
import { MINE_TRAP_PROFILES, resolveAreaTarget } from './areaEffects.ts';
import { BUILT_IN_WEAPONS, getWeaponAreaAttack } from './weapons.ts';

const weapon = (id: string) => {
  const found = BUILT_IN_WEAPONS.find(candidate => candidate.id === id);
  assert.ok(found, `missing built-in weapon ${id}`);
  return found;
};

test('manual mines and traps have a dedicated catalog category', () => {
  const catalog = BUILT_IN_WEAPONS.filter(candidate => candidate.category === 'minesTraps');
  assert.deepEqual(catalog.map(candidate => candidate.id), [
    'bullhorn_trap',
    'silent_alarm',
    'gas_trap',
    'poison_needle',
    'pit_of_spikes',
    'explosive_trap',
    'claymore_trap',
    't13_antipersonnel_mine',
    't45_se_antivehicle_mine',
  ]);
  assert.ok(catalog.every(candidate => candidate.skill === 'traps'));
});

test('T13 and T45 weapon damage matches the manual area profiles', () => {
  for (const id of ['t13_antipersonnel_mine', 't45_se_antivehicle_mine', 'pit_of_spikes']) {
    const mine = weapon(id);
    const profile = getWeaponAreaAttack(mine);
    assert.ok(profile);
    assert.equal(mine.damageDieCount, profile.damageDieCount);
    assert.equal(mine.damageDie, profile.damageDie);
    assert.equal(mine.damageBonus, profile.damageBonus);
    assert.equal(mine.damageType, profile.damageType);
  }
});

test('every manual mine/trap has a shared profile and explicit GM/status outcome', () => {
  const ids = [
    'bullhorn_trap', 'silent_alarm', 'gas_trap', 'poison_needle',
    'pit_of_spikes', 'explosive_trap', 'claymore_trap',
    't13_antipersonnel_mine', 't45_se_antivehicle_mine',
  ];
  for (const id of ids) {
    const profile = getWeaponAreaAttack(weapon(id));
    assert.ok(profile, `${id} must not fall back to generic weapon damage`);
    assert.equal(profile.rawDamage, 0, `${id} waits for a shared/manual roll`);
    assert.ok(profile.statuses?.length || profile.notes?.length, `${id} must explain its trigger`);
  }
});

test('T13 shared profile preserves blast, fragmentation, and concussion ranges', () => {
  const profile = getWeaponAreaAttack(weapon('t13_antipersonnel_mine'));
  assert.ok(profile);
  assert.equal(profile.kind, 'explosion');
  assert.deepEqual(
    [profile.fragmentation?.radius, profile.fragmentation?.damageDieCount, profile.fragmentation?.damageDie],
    [1, 1, 6],
  );
  assert.deepEqual(
    [profile.concussion?.radius, profile.concussion?.damageDieCount, profile.concussion?.damageDie],
    [3, 1, 6],
  );
});

test('T45 keeps the manual omission explicit instead of inventing concussion damage', () => {
  const profile = MINE_TRAP_PROFILES.t45_se_antivehicle_mine;
  assert.equal(profile.fragmentation?.radius, 2);
  assert.equal(profile.concussion?.radius, 4);
  assert.equal(profile.concussion?.damageDieCount, 0);
  assert.match(profile.concussion?.notes?.join(' ') ?? '', /does not print its damage die/);
});

test('weapon-trigger and AoE resolution use identical protection for a shared rolled profile', () => {
  const profile = getWeaponAreaAttack(weapon('t13_antipersonnel_mine'));
  assert.ok(profile);
  const target = {
    id: 'target', name: 'Target', endurance: 5,
    gasInhaledResistance: 0, gasContactResistance: 0,
    electricityResistance: 0, dt: 5, dr: 20,
  };
  const rolledDamage = 37;
  const fromWeaponTrigger = resolveAreaTarget({ ...profile, rawDamage: rolledDamage }, target);
  const fromAoEPicker = resolveAreaTarget({ kind: profile.kind, rawDamage: rolledDamage }, target);
  assert.equal(fromWeaponTrigger.damage, fromAoEPicker.damage);
  assert.equal(fromWeaponTrigger.resisted, fromAoEPicker.resisted);
  assert.equal(fromWeaponTrigger.unconsciousRounds, fromAoEPicker.unconsciousRounds);
});

test('shared resolver returns trap statuses and GM notes without inventing damage', () => {
  const profile = getWeaponAreaAttack(weapon('poison_needle'));
  assert.ok(profile);
  const result = resolveAreaTarget(profile, {
    id: 'target', name: 'Target', endurance: 5,
    gasInhaledResistance: 0, gasContactResistance: 0,
    electricityResistance: 0, dt: 0, dr: 0,
  });
  assert.equal(result.damage, 0);
  assert.deepEqual(result.statuses, ['poison']);
  assert.match(result.notes.join(' '), /GM adjudication/);
});

test('legacy weapons without an area profile remain compatible', () => {
  assert.equal(getWeaponAreaAttack(weapon('frag_grenade')), undefined);
  assert.equal(getWeaponAreaAttack({
    ...weapon('t13_antipersonnel_mine'),
    areaAttackProfileId: undefined,
  }), undefined);
});

test('every weapon profile and matching AoE profile resolves identically, including components', () => {
  const target = {
    id: 'target', name: 'Target', endurance: 5,
    gasInhaledResistance: 30, gasContactResistance: 50,
    electricityResistance: 0, dt: 5, dr: 20,
  };
  for (const mine of BUILT_IN_WEAPONS.filter(w => w.category === 'minesTraps')) {
    const weaponProfile = getWeaponAreaAttack(mine)!;
    const areaProfile = MINE_TRAP_PROFILES[mine.areaAttackProfileId!];
    assert.deepEqual(weaponProfile, areaProfile);
    for (const component of ['main', 'fragmentation', 'concussion'] as const) {
      const wp = component === 'main' ? weaponProfile : weaponProfile[component];
      const ap = component === 'main' ? areaProfile : areaProfile[component];
      if (!wp || !ap) continue;
      assert.deepEqual(
        resolveAreaTarget({ ...weaponProfile, ...wp, requiresGasChoice: false, rawDamage: 27 }, target, () => 40, () => 6),
        resolveAreaTarget({ ...areaProfile, ...ap, requiresGasChoice: false, rawDamage: 27 }, target, () => 40, () => 6),
      );
    }
  }
});

test('gas requires GM exposure selection and claymore preserves printed alarm reach', () => {
  assert.throws(() => resolveAreaTarget(MINE_TRAP_PROFILES.gas_trap, {
    id: 'target', name: 'Target', endurance: 5,
    gasInhaledResistance: 100, gasContactResistance: 0,
    electricityResistance: 0, dt: 0, dr: 0,
  }), /GM must select/);
  assert.match(MINE_TRAP_PROFILES.claymore_trap.notes!.join(' '), /200 meters/);
});

test('area rounds resolve explosion, concussion, and radiation separately without applying radiation to HP', () => {
  const result = resolveAreaTarget({
    kind: 'explosion',
    rawDamage: 0,
    components: [
      { id: 'blast', label: 'Blast', type: 'explosion', dmgDieCount: 0, dmgDie: 0, dmgBonus: 100 },
      { id: 'conc', label: 'Concussion', type: 'concussion', dmgDieCount: 0, dmgDie: 0, dmgBonus: 100 },
      { id: 'rads', label: 'Radiation', type: 'radiation', dmgDieCount: 0, dmgDie: 0, dmgBonus: 100 },
    ],
  }, {
    id: 'target', name: 'Target', endurance: 5,
    gasInhaledResistance: 0, gasContactResistance: 0, electricityResistance: 0,
    radiationResistance: 40,
    dt: 20, dr: 0,
    protectionByType: { explosion: { dt: 20, dr: 50 } },
  }, () => 100, () => 1);

  assert.equal(result.damage, 90); // blast 40 HP + concussion 50 HP; radiation is never HP
  assert.equal(result.radiationExposure, 60);
  assert.match(result.componentBreakdown?.join(' ') ?? '', /Blast.*40 HP.*Concussion.*50 HP.*Radiation.*60 unapplied exposure/);
});

test('area ammunition applies its DR modifier before the target-specific cap', () => {
  const component = [{ id: 'blast', label: 'Blast', type: 'explosion' as const, dmgDieCount: 0, dmgDie: 0, dmgBonus: 100 }];
  const target = {
    id: 'target', name: 'Target', endurance: 5,
    gasInhaledResistance: 0, gasContactResistance: 0, electricityResistance: 0,
    dt: 0, dr: 0, protectionByType: { explosion: { dt: 0, dr: 80 } },
  };
  const capped = resolveAreaTarget(
    { kind: 'explosion', rawDamage: 0, components: component, ammoDRModifier: 20 },
    { ...target, damageResistanceCap: 90 },
    () => 100, () => 1,
  );
  assert.equal(capped.damage, 10);
  const armorPiercing = resolveAreaTarget(
    { kind: 'explosion', rawDamage: 0, components: component, ammoDRModifier: -50 },
    { ...target, protectionByType: { explosion: { dt: 0, dr: 120 } }, damageResistanceCap: 90 },
    () => 100, () => 1,
  );
  assert.equal(armorPiercing.damage, 30);
  const manual = resolveAreaTarget(
    { kind: 'explosion', rawDamage: 0, components: component, ammoDRModifier: 20 },
    { ...target, damageResistanceCap: 100 },
    () => 100, () => 1,
  );
  assert.equal(manual.damage, 0);
});
